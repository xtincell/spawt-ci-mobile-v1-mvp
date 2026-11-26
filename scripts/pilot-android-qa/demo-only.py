"""Film the voluntary place selection and the persisted favorite on the demo account only."""
import json
import os
import subprocess
import time

from native import APK, BRUNCH, FIXTURES, OUT, PACKAGE, adb, find, login, now, tap, tree

account = FIXTURES[3]
assert account["demo"] and adb("shell", "getprop", "ro.kernel.qemu").strip() == "1"
state = {"account": "demo", "place": BRUNCH, "build": 45, "android": 15, "environment": "isolated QA", "timestamps": {}}

def log_step(name):
    state["timestamps"][name] = now()
    (OUT / "demo-standalone.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

def saved():
    query = f"select created_at from public.saved_places where spawter_id='{account['id']}' and place_id='{BRUNCH}';"
    return subprocess.check_output(["docker", "exec", os.environ["PILOT_DB_CONTAINER"], "psql", "-XAtq", "-U", "postgres", "-d", "pilot_http", "-c", query], text=True).strip()

def prepare_demo():
    """Restore a real local session for a returning synthetic demo user on a disposable emulator."""
    from urllib.request import Request, urlopen
    import hashlib
    import sqlite3
    import tempfile
    from pathlib import Path
    base = "http://127.0.0.1:54321"
    key = "sb_publishable_spawt_abidjan_local_recette"
    def request(path, token=key, payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        req = Request(base + path, data=body, headers={"apikey":key,"Authorization":"Bearer " + token,"Content-Type":"application/json"})
        with urlopen(req, timeout=12) as response:
            return json.load(response)
    phone={"phone_e164":account["phone"]}
    request("/functions/v1/otp-send",payload=phone)
    session=request("/functions/v1/otp-verify",payload={**phone,"otp_code":"123456"})
    assert session.pop("user_id")==account["id"]
    token=session["access_token"]
    assert request("/auth/v1/user", token)["id"]==account["id"]
    user,=request("/rest/v1/spawters?select=*&id=eq."+account["id"],token)
    palais,=request("/rest/v1/user_palais?select=*&spawter_id=eq."+account["id"],token)
    assert user["is_demo"] and user["is_internal"] and user["cgv_accepted_at"] and user["geoloc_consent_at"]
    state["account_preparation"]="Session du compte démo authentifiée auprès de la passerelle isolée et restaurée avant le tournage."
    rows={"sb-127-auth-token":json.dumps(session),"spawt:spawter":json.dumps(user),"spawt:palais":json.dumps(palais),
          "spawt:consent:cgv":user["cgv_accepted_at"],"spawt:consent:geoloc":user["geoloc_consent_at"]}
    with tempfile.TemporaryDirectory() as folder:
        db=Path(folder)/"RKStorage"
        with sqlite3.connect(db) as storage:
            storage.execute("PRAGMA user_version=1")
            storage.execute("create table catalystLocalStorage(key text primary key, value text not null)")
            storage.executemany("insert into catalystLocalStorage(key,value) values(?,?)",rows.items())
        blob=db.read_bytes()
        adb("shell","run-as",PACKAGE,"mkdir","-p","databases")
        subprocess.run(["adb","shell","-T",f"run-as {PACKAGE} sh -c 'cat > databases/RKStorage'"],input=blob,check=True)
        assert hashlib.sha256(blob).hexdigest() in adb("shell","run-as",PACKAGE,"sha256sum","databases/RKStorage")

def locate_result(timeout=45):
    from native import touch
    until=time.monotonic()+timeout
    while time.monotonic()<until:
        surface=tree()
        for node in surface.iter("node"):
            for attr in ("content-desc","text"):
                name=node.get(attr,"")
                if "concept store" in name.casefold() and "in" in name.casefold():
                    return node
        time.sleep(1)
    raise RuntimeError("IN’ Concept Store absent des résultats visibles.")

def enter_search():
    adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "spawt://search", "-p", PACKAGE)
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        editors = [node for node in tree().iter("node") if node.get("class") == "android.widget.EditText"]
        if editors:
            from native import touch
            touch(editors[0])
            adb("shell", "input", "text", "Concept")
            if "mInputShown=true" in adb("shell", "dumpsys", "input_method"):
                adb("shell", "input", "keyevent", "4")
            try:
                locate_result()
            except RuntimeError:
                with (OUT / "demo-search-diagnostic.png").open("wb") as screen:
                    subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=screen, check=True)
                raise
            return
        time.sleep(1)
    raise RuntimeError("The editable search surface did not become visible")

subprocess.run(["adb", "uninstall", PACKAGE], capture_output=True)
adb("install", APK, timeout=180)
adb("shell", "pm", "grant", PACKAGE, "android.permission.POST_NOTIFICATIONS")
prepare_demo()
adb("shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity")
try:
    find("Accueil", 155)
except RuntimeError:
    with (OUT / "demo-before-search.png").open("wb") as screen:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=screen, check=True)
    print(adb("shell", "dumpsys", "activity", "activities").split("mResumedActivity")[-1][:220])
    raise
log_step("demo_connected")
enter_search()
assert not saved(), "The isolated demo favorite already exists"
remote = "/sdcard/demo-in.mp4"
proc = subprocess.Popen(["adb", "shell", "screenrecord", "--size", "720x1440", "--bit-rate", "5000000", "--time-limit", "100", remote])
try:
    time.sleep(2.5)
    log_step("recording")
    from native import touch
    touch(locate_result())
    find("IN’ Concept Store")
    find("Prix à préciser")
    find("Sauvegarde pour plus tard")
    log_step("place_opened")
    time.sleep(2.5)
    tap("Sauvegarde pour plus tard")
    find("Sauvegardé")
    log_step("saved_on_screen")
    until = time.monotonic() + 50
    while time.monotonic() < until:
        created = saved()
        if created:
            state["favorite_created_utc"] = created
            break
        time.sleep(0.5)
    assert state.get("favorite_created_utc"), "No stored favorite on the demo account"
    time.sleep(3.5)
    log_step("server_confirmed")
finally:
    pid = adb("shell", "pidof", "screenrecord").strip()
    if pid.isdigit(): adb("shell", "kill", "-2", pid)
    proc.wait(timeout=20)
adb("pull", remote, str(OUT / "Jean-Claude-demo-Android.mp4"))
