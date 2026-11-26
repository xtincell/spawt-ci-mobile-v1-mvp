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
                find("IN’ Concept Store")
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
adb("shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity")
login(account)
find("Accueil", 65)
log_step("demo_connected")
enter_search()
assert not saved(), "The isolated demo favorite already exists"
remote = "/sdcard/demo-in.mp4"
proc = subprocess.Popen(["adb", "shell", "screenrecord", "--size", "720x1440", "--bit-rate", "5000000", "--time-limit", "100", remote])
try:
    time.sleep(2.5)
    log_step("recording")
    tap("IN’ Concept Store")
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
