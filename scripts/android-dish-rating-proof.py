"""Read the three independent choices back from the production API under a synthetic QA session."""
import hashlib
import importlib.util
import json
import pathlib
import re
import time
import urllib.request
import uuid

path=pathlib.Path(__file__).with_name("android-ui-review.py")
spec=importlib.util.spec_from_file_location("screens",path)
ui=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
env=json.loads(pathlib.Path("app/eas.json").read_text())["build"]["preview"]["env"]
api=env["EXPO_PUBLIC_SUPABASE_URL"]
assert api=="https://api.spawt.online"
key=env["EXPO_PUBLIC_SUPABASE_ANON_KEY"]
ui.out=pathlib.Path("android-proof")
metadata=json.loads((ui.out/"apk-metadata.json").read_text())
target=json.loads(pathlib.Path("documentation/android-qa.json").read_text())
assert metadata["build"]==target["build"]==48 and metadata["sourceCommit"]==target["sourceCommit"]
with pathlib.Path("spawt.apk").open("rb") as binary:
    assert hashlib.file_digest(binary,"sha256").hexdigest()==metadata["sha256"]
evidence={"build":48,"sha256":metadata["sha256"],"api":api,"checks":[],"source":metadata["sourceCommit"]}
def call(path,payload=None,token=None):
    req=urllib.request.Request(api+path,data=json.dumps(payload).encode() if payload is not None else None,
        headers={"apikey":key,"Authorization":"Bearer "+(token or key),"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=24) as response:
        raw=response.read()
        return json.loads(raw) if raw else None
def session(phone,owner):
    ack=call("/functions/v1/otp-send",{"phone_e164":phone})
    assert ack["success"] and ack["request_id"].startswith(("reviewer-","mock-"))
    auth=call("/functions/v1/otp-verify",{"phone_e164":phone,"otp_code":"123456"})
    assert auth["success"] and auth["user_id"]==owner
    return auth["access_token"]
def current(token,owner):
    places=call("/rest/v1/saved_places?select=place_id&spawter_id=eq."+owner+"&place_id=eq."+ui.BRUNCH,token=token)
    outings=call("/rest/v1/rpc/my_outings",{"p_owner":owner},token)
    ratings=call("/rest/v1/rpc/my_menu_item_ratings",{},token)
    score=next((row["rating"] for row in ratings if row["menu_item_id"]==ui.DISH),None)
    return bool(places),any(d["id"]==ui.DISH for d in outings["dishes"]),score
accounts=[("+2250000000193","d7ea30bc-fb7f-440d-bac6-4bbd306f1e42")]
for phone, owner in accounts:
    token=session(phone,owner)
    original=current(token,owner)
    memberships=call("/rest/v1/rpc/my_outings",{"p_owner":owner},token)["items"]
    in_existing_list=any(item.get("place_id")==ui.BRUNCH or item.get("menu_item_id")==ui.DISH for item in memberships)
    if original==(False,False,None) and not in_existing_list:break
    call("/auth/v1/logout?scope=local",{},token)
else:raise RuntimeError("No clean synthetic QA state for these two targets")
def await_state(expected):
    for _ in range(25):
        if current(token,owner)==expected:return
        time.sleep(1)
    raise RuntimeError("Server did not confirm the expected synthetic state")

def verify(name,expected):
    await_state(expected)
    evidence["checks"].append({"name":name,"place":expected[0],"dish":expected[1],"rating":expected[2],"at":ui.now()})
def login():
    ui.open_url("spawt://phone");ui.tap("phone-input");ui.adb("shell","input","text",phone.removeprefix("+225"))
    ui.adb("shell","input","keyevent","4");ui.tap("phone-send")
    for i,ch in enumerate("123456"):
        ui.tap("otp-cell-"+str(i));ui.adb("shell","input","text",ch)
    ui.find("Accueil")
def search_dish():
    ui.open_url("spawt://search")
    field=ui.wait_node(lambda n:n.get("class")=="android.widget.EditText")
    ui.touch(field)
    if field.get("text",""):
        ui.adb("shell","input","keycombination","113","29");ui.adb("shell","input","keyevent","67")
    ui.adb("shell","input","text","Eggs")
    if "mInputShown=true" in ui.adb("shell","dumpsys","input_method"):ui.adb("shell","input","keyevent","4")
    ui.find("dish-rating-"+ui.DISH)
def tap_dish_favorite(label):
    target=ui.find("save-intent-"+ui.DISH)
    assert ui.match(label,target), "Favorite control for target dish has an unexpected action"
    ui.touch(target)

def rate(value):
    ui.tap("dish-rating-"+ui.DISH)
    ui.find("dish-score-4")
    if value is None:ui.tap("dish-rating-clear")
    else:ui.tap("dish-score-"+str(value));ui.tap("dish-rating-save")
def receive_favorite_upgrade():
    previous_sha="88042ac19e7c6d3af6626f761f25eab45bbe3d212651af05f0a8ab1e66214129"
    with pathlib.Path("previous.apk").open("rb") as binary:
        assert hashlib.file_digest(binary,"sha256").hexdigest()==previous_sha
    assert ui.adb("get-serialno").strip().startswith("emulator-")
    assert "Success" in ui.adb("uninstall",ui.PACKAGE)
    assert "Success" in ui.adb("install","previous.apk",timeout=180)
    before=ui.adb("shell","dumpsys","package",ui.PACKAGE)
    assert re.search(r"versionCode=47\b",before)
    initial=re.search(r"firstInstallTime=([^\r\n]+)",before)
    assert initial is not None
    ui.adb("shell","pm","grant",ui.PACKAGE,"android.permission.POST_NOTIFICATIONS")
    login()
    ui.open_url("spawt://place/"+ui.BRUNCH)
    ui.find("IN’ Concept Store")
    ui.tap("Sauvegarde pour plus tard")
    ui.find("Sauvegardé")
    await_state((True,False,None))
    assert "Success" in ui.adb("install","-r","spawt.apk",timeout=180)
    after=ui.adb("shell","dumpsys","package",ui.PACKAGE)
    assert re.search(r"versionCode=48\b",after)
    updated=re.search(r"firstInstallTime=([^\r\n]+)",after)
    assert updated and updated.group(1).strip()==initial.group(1).strip()
    ui.adb("shell","am","start","-W","-n",ui.PACKAGE+"/.MainActivity")
    ui.find("Accueil")
    ui.open_url("spawt://saved");ui.find("saved-place-"+ui.BRUNCH)
    ui.open_url("spawt://place/"+ui.BRUNCH);ui.find("IN’ Concept Store");ui.tap("Lieu enregistré")
    await_state((False,False,None))
    evidence["upgradeFavorite"]={"from":47,"to":48,"previousSha256":previous_sha,"previousFavoriteSaved":True,
        "updateOverPrevious":True,"firstInstallTimePreserved":True,"sessionRestoredWithoutOtp":True,
        "favoriteReadAfterUpgrade":True,"removedFromUpdatedApp":True}

try:
    login();search_dish()
    ui.tap("dish-rating-"+ui.DISH);ui.find("dish-score-4")
    verify("editor_optional",(False,False,None))
    ui.tap("dish-score-4");verify("draft_only",(False,False,None))
    ui.shot("note-du-plat");ui.tap("dish-rating-save");verify("rated_without_saves",(False,False,4))
    rate(2);verify("rating_changed",(False,False,2))
    rate(None);verify("rating_removed",(False,False,None))
    tap_dish_favorite("Ajouter aux favoris");verify("only_dish",(False,True,None))
    ui.open_url("spawt://place/"+ui.BRUNCH);ui.tap("Enregistrer le lieu");verify("place_and_dish",(True,True,None))
    ui.open_url("spawt://saved");ui.find("saved-place-"+ui.BRUNCH)
    first=ui.find("Lieux enregistrés")
    ui.shot("envies-lieu-premier")
    second=next((n for n in ui.tree().iter("node") if ui.match("Favoris plats",n)),None)
    if second is not None:
        def top(node):return int(re.findall(r"-?\d+",node.get("bounds",""))[1])
        assert top(first)<top(second)
    else:
        ui.adb("shell","input","swipe","490","1340","490","700","430")
        ui.find("Favoris plats")
    def dish_price(n):
        text=n.get("content-desc","")+" "+n.get("text","")
        return "Eggs Benedict" in text and "7000FCFA" in "".join(text.split())
    for _ in range(5):
        if any(dish_price(n) for n in ui.tree().iter("node")):
            break
        ui.adb("shell","input","swipe","490","1340","490","800","430")
        time.sleep(.5)
    else:raise RuntimeError("The saved dish and its public menu price were not shown together")
    ui.shot("envies-favoris-plats")
    evidence["saved_sections"]=["Lieux enregistrés","Favoris plats"]
    search_dish();tap_dish_favorite("Retirer le plat des favoris");verify("only_place",(True,False,None))
    ui.open_url("spawt://place/"+ui.BRUNCH);ui.tap("Lieu enregistré");verify("neither",(False,False,None))
    receive_favorite_upgrade()
finally:
    place,dish,score=current(token,owner)
    if score is not None:call("/rest/v1/rpc/set_menu_item_rating",{"p_menu_item_id":ui.DISH,"p_rating":None},token)
    for state,field,value in ((dish,"menu_item_id",ui.DISH),(place,"place_id",ui.BRUNCH)):
        if state:call("/rest/v1/rpc/mutate_outing",{"p_id":str(uuid.uuid4()),"p_action":"unsave","p_payload":{field:value},"p_owner":owner},token)
    verify("original_state_restored",original)
    call("/auth/v1/logout?scope=local",{},token)
    (ui.out/"dish-rating-48.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
