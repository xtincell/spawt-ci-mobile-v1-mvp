"""Inspect the signed candidate using only the synthetic review account and public venue data."""
import importlib.util
import json
import pathlib
import time
import urllib.request
import uuid
import hashlib
import os
import re
import subprocess

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
digest = "88042ac19e7c6d3af6626f761f25eab45bbe3d212651af05f0a8ab1e66214129"
ui.results.update(native="APK signé Android 1.1.6 (47)", api=origin, sha256=digest)
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
    assert not original["place_id"], "Reserved place is already saved; no genuine new save can be proved"
    ui.results["favori_absent_avant"]=ui.now()
    additions={}
    try:
        for field,value in (("place_id",ui.BRUNCH),("menu_item_id",ui.DISH)):
            if original[field]:continue
            assert not any(item.get(field)==value for item in items), "Existing saved-list membership cannot be changed"
            if field=="place_id":
                ui.open_url("spawt://place/"+ui.BRUNCH);ui.find("IN’ Concept Store")
                ui.find("Sauvegarde pour plus tard")
                ui.results["fiche_ouverte"]={"lieu":ui.BRUNCH,"at":ui.now()}
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
        ui.results["serveur_apres_geste"]={"lieu":ui.BRUNCH,"at":ui.now()}
        ui.adb("shell","am","force-stop",ui.PACKAGE)
        ui.adb("shell","am","start","-W","-n",ui.PACKAGE+"/.MainActivity")
        ui.find("Accueil",timeout=90)
        ui.results["redemarrage_authentifie"]=ui.now()
        ui.open_url("spawt://place/"+ui.BRUNCH)
        ui.find("IN’ Concept Store");ui.find("Sauvegardé")
        ui.results["favori_apres_redemarrage"]=ui.now()
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


def metadata(version, code):
    info = ui.adb("shell", "dumpsys", "package", ui.PACKAGE)
    assert re.search(r"versionCode="+str(code)+r"\b", info)
    assert "versionName="+version in info
    first = re.search(r"firstInstallTime=([^\r\n]+)", info)
    uid = re.search(r"(?:userId|appId)=(\d+)", info)
    assert first and uid
    return first[1].strip(), uid[1]

def launch():
    ui.adb("shell","am","start","-W","-n",ui.PACKAGE+"/.MainActivity")
    ui.find("splash-start",timeout=90)
    assert ui.adb("shell","pidof",ui.PACKAGE).strip().isdigit()

def upgrade_and_clean():
    legacy, apk = os.environ["PILOT_LEGACY_APK"], os.environ["PILOT_DEBUG_APK"]
    assert subprocess.run(["adb","shell","pm","list","packages",ui.PACKAGE],capture_output=True).stdout.strip()==b""
    ui.adb("install", legacy, timeout=180)
    before = metadata("1.1.4",45)
    launch()
    ui.adb("shell","am","force-stop",ui.PACKAGE)
    assert "Success" in ui.adb("install","-r",apk,timeout=180)
    assert metadata("1.1.6",47)==before
    launch()
    ui.results["mise_a_jour"]={"de":45,"vers":47,"premiere_installation_et_uid_conserves":True,"demarrage_confirme":ui.now()}
    assert "Success" in ui.adb("uninstall",ui.PACKAGE)
    assert "Success" in ui.adb("install",apk,timeout=180)
    metadata("1.1.6",47)
    launch()
    ui.shot("onboarding-propre")
    ui.results["installation_propre"]={"ecran":"splash-start","at":ui.now()}
    ui.adb("shell","pm","grant",ui.PACKAGE,"android.permission.POST_NOTIFICATIONS")

def main():
    ui.results["build"]=47
    ui.results["android_api"]=ui.adb("shell","getprop","ro.build.version.sdk").strip()
    assert ui.results["android_api"]=="35"
    for label, action in [("Mise à jour et installation propre", upgrade_and_clean),
                          ("Identification interne",login),("Mes envies",capture_saved)]:
        ui.stage(label,action)
        if not ui.results["screens"][label]["pass"]: return 1
    assert ui.results["etat_initial_retabli"] and ui.results["serveur_apres_geste"]["lieu"]==ui.results["fiche_ouverte"]["lieu"]
    return 0

if __name__=="__main__":
    raise SystemExit(main())
