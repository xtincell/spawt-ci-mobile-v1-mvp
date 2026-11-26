"""Inspect the signed candidate using only the synthetic review account and public venue data."""
import importlib.util
import json
import pathlib
import time
import urllib.request
import uuid

script = pathlib.Path(__file__).with_name("android-ui-review.py")
spec = importlib.util.spec_from_file_location("ui46",script)
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
config = json.loads(pathlib.Path("app/eas.json").read_text())["build"]["preview"]["env"]
origin = config["EXPO_PUBLIC_SUPABASE_URL"]
assert origin == "https://api.spawt.online"
key = config["EXPO_PUBLIC_SUPABASE_ANON_KEY"]
phone = "+2250000000193"
owner = "d7ea30bc-fb7f-440d-bac6-4bbd306f1e42"
digest = "0f2f78ccaf65ece6467c23f5969eacdf5821773790ddcf3a00bcce2a7e87690f"
ui.results.update(native="APK signé Android 1.1.5 (46)", api=origin, sha256=digest)
def request(path,payload=None,token=None):
    req = urllib.request.Request(origin+path,data=json.dumps(payload).encode() if payload is not None else None,
        headers={"apikey":key,"Authorization":"Bearer "+(token or key),"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=25) as response:
        raw=response.read()
        return json.loads(raw) if raw else None

def login():
    ui.open_url("spawt://phone")
    ui.tap("phone-input");ui.adb("shell","input","text",phone.removeprefix("+225"))
    ui.adb("shell","input","keyevent","4");ui.tap("phone-send")
    for i, digit in enumerate("123456"):
        ui.tap(f"otp-cell-{i}");ui.adb("shell","input","text",digit)
    ui.find("Accueil")

def capture_saved():
    sent=request("/functions/v1/otp-send",{"phone_e164":phone})
    assert sent["success"] and sent["request_id"].startswith(("mock-","reviewer-"))
    session=request("/functions/v1/otp-verify",{"phone_e164":phone,"otp_code":"123456"})
    assert session["success"] and session["user_id"]==owner
    token=session["access_token"]
    def current():
        places=request("/rest/v1/saved_places?select=place_id&spawter_id=eq."+owner+"&place_id=eq."+ui.BRUNCH,token=token)
        snapshot=request("/rest/v1/rpc/my_outings",{"p_owner":owner},token)
        return {"place_id":bool(places),"menu_item_id":any(d["id"]==ui.DISH for d in snapshot["dishes"])},snapshot["items"]
    def same(expected):
        for _ in range(30):
            if current()[0]==expected:return
            time.sleep(1)
        raise RuntimeError("Synthetic favorites were not acknowledged in the expected state")
    menu,=request("/rest/v1/public_menu_items?select=id,name,price_xof,place_id&id=eq."+ui.DISH)
    assert menu["name"]=="Eggs Benedict" and menu["price_xof"]==7000 and menu["place_id"]==ui.BRUNCH
    original,items=current()
    additions={}
    try:
        for field,value in (("place_id",ui.BRUNCH),("menu_item_id",ui.DISH)):
            if original[field]:continue
            assert not any(item.get(field)==value for item in items), "Existing saved-list membership cannot be changed"
            if field=="place_id":
                ui.open_url("spawt://place/"+ui.BRUNCH);ui.find("IN’ Concept Store")
                ui.find("Sauvegarde pour plus tard")
                additions[field]=value
                ui.tap("Sauvegarde pour plus tard");ui.find("Sauvegardé")
            else:
                ui.open_url("spawt://search")
                ui.touch(ui.wait_node(lambda n:n.get("class")=="android.widget.EditText"))
                ui.adb("shell","input","text","Eggs")
                if "mInputShown=true" in ui.adb("shell","dumpsys","input_method"):ui.adb("shell","input","keyevent","4")
                ui.find("save-intent-"+ui.DISH)
                additions[field]=value
                ui.tap("save-intent-"+ui.DISH)
        same({"place_id":True,"menu_item_id":True})
        ui.open_url("spawt://saved")
        def dish(n):
            label=n.get("text","")+" "+n.get("content-desc","")
            return "Eggs Benedict" in label and "7000FCFA" in "".join(label.split())
        ui.wait_node(dish);ui.shot("mes-envies")
        for _ in range(3):
            if any(ui.match("saved-place-"+ui.BRUNCH,n) or
                    ("IN’ Concept Store" in n.get("content-desc","") and "Eggs Benedict" not in n.get("content-desc",""))
                    for n in ui.tree().iter("node")):break
            ui.adb("shell","input","swipe","500","1500","500","650","480");time.sleep(.7)
        else: raise RuntimeError("Missing saved address")
        ui.shot("mes-envies-adresse")
        ui.results["favoris_acquittes"]={"plat":ui.DISH,"lieu":ui.BRUNCH,"prix_xof":menu["price_xof"],"at":ui.now()}
    finally:
        for field,value in additions.items():
            request("/rest/v1/rpc/mutate_outing",{"p_id":str(uuid.uuid4()),"p_action":"unsave","p_payload":{field:value},"p_owner":owner},token)
        same(original)
        ui.results["etat_initial_retabli"]=True
        request("/auth/v1/logout?scope=local",{},token)

ui.stage("Le Cha", ui.le_cha)
ui.stage("Identification interne",login)
if ui.results["screens"]["Identification interne"]["pass"]:
    ui.stage("Mes envies",capture_saved)
    ui.stage("Carte",ui.carte)
(ui.out/"recu.json").write_text(json.dumps(ui.results,ensure_ascii=False,indent=2))
if not all(item["pass"] for item in ui.results["screens"].values()):raise SystemExit(1)
