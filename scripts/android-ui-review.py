"""Exercise the three real screens against loopback data, then retain their Android pixels."""
import json
import os
import pathlib
import re
import subprocess
import sys
import sqlite3
import tempfile
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).with_name("pilot-android-qa")))
from PIL import Image
import native
from native import adb, ANON, BRUNCH, FIXTURES, find, match, now, PACKAGE, tap, touch, tree

out = pathlib.Path("ui-review")
out.mkdir(exist_ok=True)
results = {"source": os.environ["GITHUB_SHA"],
           "app_tree": subprocess.check_output(["git","rev-parse","HEAD:app"],text=True).strip(),
           "native": "debug x86_64 build 45, Android 15",
           "api": "isolated loopback fixture", "screens": {}}
review = json.loads(pathlib.Path("app/src/data/le-cha-review.json").read_text())
DISH = "6dad3f00-d87f-4c70-87a7-b083af11c4d7"
inventory = json.loads(pathlib.Path("scripts/pilot-android-qa/lieux-abidjan-publics.json").read_text())
raw_tree = tree
def read_surface():
    ui = raw_tree()
    wait = next((n for n in ui.iter("node") if n.get("package")=="android" and
                 n.get("resource-id","").endswith("/aerr_wait")), None)
    if wait is not None:
        last = adb("shell","dumpsys","activity","lastanr") + "\n" + adb("logcat","-d","-b","events","-s","am_anr")
        owners = re.findall(r"(?:ANR in |\[\d+,\d+,)([a-z][\w.]+)",last)
        owner = owners[-1] if owners else "indéterminé"
        events = results.setdefault("dialogues_android_attendre",[])
        events.append({"at":now(),"process":owner})
        if owner not in ("com.android.systemui","com.google.android.apps.nexuslauncher","com.android.launcher3") or len(events)>2:
            raise RuntimeError("Android signale une ANR de "+owner)
        touch(wait)
        time.sleep(4)
        return raw_tree()
    return ui
# Both this script and the shared UI finders must observe and record the same system dialog.
tree = native.tree = read_surface
def open_url(url):
    adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d",url,"-p",PACKAGE)
def shot(name):
    time.sleep(.7)
    (out/(name+".png")).write_bytes(subprocess.check_output(["adb","exec-out","screencap","-p"]))
def wait_node(predicate, timeout=32):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        for node in tree().iter("node"):
            if predicate(node):
                return node
        time.sleep(.4)
    raise RuntimeError("Le contrôle attendu ne figure pas dans la vue visible.")
def diagnose(name):
    ui = tree()
    labels = [node.get(key, "") for node in ui.iter("node") for key in ("text", "content-desc")]
    known = ("Mes envies","Aucune envie enregistrée","Chargement","Réessayer","Synchronisation",
             "Connexion","Une erreur","Créer une liste","Eggs Benedict","IN’ Concept Store","Carte","Accueil")
    ids = {node.get("resource-id","").split("/")[-1] for node in ui.iter("node")}
    info = {"identifiants":sorted(i for i in ids if re.fullmatch(r"[a-zA-Z][\w-]{1,70}",i)),
            "libelles": [label for label in known if any(label.casefold() in text.casefold() for text in labels)]}
    # Only photograph known product views with no phone, OTP, email or editable field.
    private = any(node.get("class") == "android.widget.EditText" for node in ui.iter("node")) or any(
        re.search(r"@|\+225|\b[\d \u202f-]{10,}\b",label) for label in labels)
    if not private and any(label in info["libelles"] for label in ("Mes envies","Eggs Benedict","IN’ Concept Store","Carte")):
        shot("diagnostic-"+name)
    return info
def stage(name, run):
    print("Écran :",name,flush=True)
    try:
        run()
        results["screens"][name] = {"pass":True,"at":now()}
    except Exception as error:
        results["screens"][name] = {"pass":False,"error":str(error),"at":now()}
        try:
            results["screens"][name]["surface"] = diagnose(name)
        except Exception:
            pass
        print(name, error, flush=True)
    (out/"recu.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
def le_cha():
    open_url("https://spawt.online/ouvrir/avis/le-cha-alexandre")
    find("le-cha-review-title",95); find("le-cha-review-photo"); find("le-cha-review-comment")
    find(review["author"])
    observed = tree()
    for label in ("Cuisine 4,5/5", "Cadre 4/5", "Service 3/5"):
        assert any(label in n.get("content-desc","") for n in observed.iter("node")), label
    shot("le-cha")
    adb("shell","am","force-stop",PACKAGE)
def authenticate():
    # This suite photographs existing screens. Restore a real, previously consented demo session.
    account = FIXTURES[3]
    assert account["demo"] and adb("shell","getprop","ro.kernel.qemu").strip()=="1"
    adb("shell","am","force-stop",PACKAGE)
    base="http://127.0.0.1:54321"
    def req(path, token=ANON, payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        request=urllib.request.Request(base+path,data=body,headers={"apikey":ANON,"Authorization":"Bearer "+token,"Content-Type":"application/json"})
        with urllib.request.urlopen(request,timeout=18) as r:
            return json.load(r)
    phone={"phone_e164":account["phone"]}
    req("/functions/v1/otp-send",payload=phone)
    session=req("/functions/v1/otp-verify",payload={**phone,"otp_code":"123456"})
    assert session.pop("user_id")==account["id"]
    token=session["access_token"]
    assert req("/auth/v1/user",token)["id"]==account["id"]
    user,=req("/rest/v1/spawters?select=*&id=eq."+account["id"],token)
    palais,=req("/rest/v1/user_palais?select=*&spawter_id=eq."+account["id"],token)
    assert user["is_demo"] and user["cgv_accepted_at"] and user["geoloc_consent_at"]
    assert len(req("/rest/v1/places?select=id&is_published=eq.true&city_code=eq.abidjan",token))==155
    dish,=req("/rest/v1/public_menu_items?id=eq."+DISH,token)
    assert dish["price_xof"]==7000
    # Forward to the device's own loopback, which the app reaches through adb reverse.
    # An HTTP client can validate the response without racing netcat's stdin EOF.
    adb("reverse","tcp:54321","tcp:54321")
    port=adb("forward","tcp:0","tcp:54321").strip()
    assert port.isdecimal()
    try:
        request=urllib.request.Request("http://127.0.0.1:"+port+"/rest/v1/places?select=id&is_published=eq.true&city_code=eq.abidjan",
            headers={"apikey":ANON,"Authorization":"Bearer "+token})
        with urllib.request.urlopen(request,timeout=15) as response:
            assert len(json.load(response))==155
    finally:
        adb("forward","--remove","tcp:"+port)
    results["inventaire_depuis_android"]={"nombre":155,"prix_catalogue":dish["price_xof"],"at":now()}
    rows={"sb-127-auth-token":json.dumps(session),"spawt:spawter":json.dumps(user),"spawt:palais":json.dumps(palais),
          "spawt:consent:cgv":user["cgv_accepted_at"],"spawt:consent:geoloc":user["geoloc_consent_at"]}
    with tempfile.TemporaryDirectory() as directory:
        file=pathlib.Path(directory)/"RKStorage"
        with sqlite3.connect(file) as db:
            db.execute("PRAGMA user_version=1")
            db.execute("CREATE TABLE catalystLocalStorage(key text primary key,value text not null)")
            db.executemany("INSERT INTO catalystLocalStorage(key,value) VALUES(?,?)",rows.items())
        adb("shell","run-as",PACKAGE,"mkdir","-p","databases")
        subprocess.run(["adb","shell","-T",f"run-as {PACKAGE} sh -c 'cat > databases/RKStorage'"],input=file.read_bytes(),check=True)
    adb("shell","am","start","-W","-n",PACKAGE+"/.MainActivity")
    find("Accueil",120)
def saved():
    open_url("spawt://place/"+BRUNCH);find("IN’ Concept Store")
    tap("Sauvegarde pour plus tard");find("Sauvegardé")
    open_url("spawt://search")
    field = wait_node(lambda n: n.get("class") == "android.widget.EditText")
    touch(field)
    adb("shell","input","text","Eggs")
    if "mInputShown=true" in adb("shell","dumpsys","input_method"):
        adb("shell","input","keyevent","4")
    tap("save-intent-"+DISH)
    # Both records must be written by native gestures, owned by this demonstration account.
    owner = FIXTURES[3]["id"]
    query = f"""SELECT EXISTS(SELECT FROM saved_places WHERE spawter_id='{owner}' AND place_id='{BRUNCH}')
      AND EXISTS(SELECT FROM saved_menu_items WHERE spawter_id='{owner}' AND menu_item_id='{DISH}');"""
    deadline = time.monotonic()+40
    while subprocess.check_output(["docker","exec",os.environ["PILOT_DB_CONTAINER"],"psql","-XAtq","-U","postgres",
                                   "-d","pilot_http","-c",query],text=True).strip() != "t":
        if time.monotonic() >= deadline:
            raise AssertionError("Acquittement du plat et de l’adresse absent de la base isolée.")
        time.sleep(1)
    results["favoris_acquittes"] = {"plat":DISH,"lieu":BRUNCH,"at":now()}
    open_url("spawt://saved")
    def purchased(n):
        label = " ".join((n.get("text",""),n.get("content-desc","")))
        return "Eggs Benedict" in label and "7000FCFA" in "".join(label.split())
    wait_node(purchased)
    shot("mes-envies")
    try:
        find("Mes adresses",5)
    except RuntimeError:
        bounds=find("saved-screen").get("bounds","")
        x1,y1,x2,y2 = map(int,re.findall(r"-?\d+",bounds))
        x=(x1+x2)//2
        adb("shell","input","swipe",str(x),str(y1+int((y2-y1)*.75)),str(x),str(y1+int((y2-y1)*.38)),"400")
    wait_node(lambda n: match("saved-place-"+BRUNCH,n) or ("IN’ Concept Store" in n.get("content-desc","") and "Eggs Benedict" not in n.get("content-desc","")))
    shot("mes-envies-adresse")
def empty_saved():
    open_url("spawt://saved")
    wait_node(lambda n: any(match(label,n) for label in ("saved-empty","Aucune envie enregistrée","Chercher un plat ou une adresse")))
    shot("mes-envies-vide")
def marker_centers(source, rect):
    """Read actual golden marker centres in the bounded MapLibre surface on this emulator."""
    image = Image.open(source).convert("RGB")
    left,top,right,bottom = rect
    step=3
    pixels=image.load()
    colored={(x,y) for y in range(top+12,bottom-32,step) for x in range(left+12,right-12,step)
             if all(abs(actual-target)<24 for actual,target in zip(pixels[x,y],(200,164,78)))}
    candidates=[]
    while colored:
        group=[colored.pop()]
        for x,y in group:
            for other in ((x-step,y),(x+step,y),(x,y-step),(x,y+step)):
                if other in colored:
                    colored.remove(other);group.append(other)
        xs,ys=zip(*group)
        if 8<=max(xs)-min(xs)<=90 and 8<=max(ys)-min(ys)<=90:
            candidates.append(((min(xs)+max(xs))//2,(min(ys)+max(ys))//2))
    return sorted(candidates,key=lambda p:(p[0]-(right+left)/2)**2+(p[1]-(bottom+top)/2)**2)
def carte():
    open_url("spawt://carte");find("carte-inventory-count");find("carte-mapview");time.sleep(8)
    for label in ("carte-filter-all","carte-filter-unexplored","carte-filter-mine"): find(label,5)
    shot("carte")
    rect = tuple(map(int,re.findall(r"-?\d+",find("carte-mapview").get("bounds",""))))
    for x,y in marker_centers(out/"carte.png",rect)[:12]:
        adb("shell","input","tap",str(x),str(y))
        try:
            card = find("carte-open-selected",3)
        except RuntimeError:
            continue
        label = card.get("content-desc","")
        place = next((p for p in inventory if p["neighborhood"] and label.strip().endswith(p["name"])),None)
        if place:
            shot("carte-adresse")
            results["lieu_sur_la_carte"]={"nom":place["name"],"quartier":place["neighborhood"]}
            tap("carte-close-selected")
            break
        tap("carte-close-selected")
    else:
        raise AssertionError("Aucun point du catalogue avec quartier n’a ouvert sa fiche.")
    tap("carte-view-toggle");time.sleep(1);shot("carte-liste");tap("carte-view-toggle");find("carte-mapview")
stage("Le Cha",le_cha)
stage("Identification interne",authenticate)
if results["screens"]["Identification interne"]["pass"]:
    stage("Mes envies vide",empty_saved);stage("Mes envies",saved);stage("Carte",carte)
(out/"recu.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
if not all(r["pass"] for r in results["screens"].values()):sys.exit(1)
