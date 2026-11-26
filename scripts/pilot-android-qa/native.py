"""Exercise the candidate's UI on a disposable emulator against the loopback-only fixture."""
import datetime
import json
import os
import pathlib
import re
import subprocess
import time
import urllib.request
import uuid
import xml.etree.ElementTree as ET

PACKAGE = "com.upgraders.spawt"
BRUNCH = "c5acfd12-01dd-5cd3-9beb-0531d89c3e99"
OUT = pathlib.Path("pilot-proof")
OUT.mkdir(exist_ok=True)
FIXTURES = json.loads(pathlib.Path(__file__).with_name("comptes-test.json").read_text(encoding="utf-8-sig"))
ANON = "sb_publishable_spawt_abidjan_local_recette"
APK = os.environ["PILOT_DEBUG_APK"]

def adb(*args, timeout=100):
    return subprocess.check_output(["adb", *args], timeout=timeout).decode(errors="replace")

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")

def tree():
    adb("shell", "uiautomator", "dump", "/sdcard/pilot-ui.xml")
    return ET.fromstring(adb("exec-out", "cat", "/sdcard/pilot-ui.xml").strip())

def match(label, node):
    aliases = {
        "pilot-open-place": ("Ouvrir la fiche",),
        "pilot-code-input": ("Code de reprise",),
        "pilot-code-submit": ("Retrouver le lieu",),
        "pilot-enter-code": ("Reprendre avec un code",),
    }
    names = {value.casefold() for value in (label, *aliases.get(label, ()))}
    if node.get("resource-id", "").rsplit("/", 1)[-1].casefold() in names:
        return True
    # React Native can group accessibility labels and hints with a comma.
    values = (node.get("text", ""), *re.split(r"[,\n]", node.get("content-desc", "")))
    return any(value.strip().casefold() in names for value in values)

def dismiss_notification_prompt(surface):
    nodes = [n for n in surface.iter("node") if n.get("package", "").endswith(".permissioncontroller")]
    prompt = any("notification" in n.get("text", "").casefold() for n in nodes)
    deny = next((n for n in nodes if n.get("resource-id", "").endswith("/permission_deny_button")), None)
    if not prompt or deny is None:
        return False
    # Capture only the decision button. The screen behind the OS dialog is excluded.
    left, top, right, bottom = map(int, re.findall(r"-?\d+", deny.get("bounds", "")))
    target = OUT/"dialogue-android-notifications.png"
    if not target.exists() and right > left and bottom > top:
        screenshot = subprocess.check_output(["adb", "exec-out", "screencap", "-p"])
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", "pipe:0", "-vf",
                        f"crop={right-left}:{bottom-top}:{left}:{top}", "-frames:v", "1", str(target)],
                       input=screenshot, check=False)
    touch(deny)
    return True

def find(label, timeout=70):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        try:
            surface=tree()
            if dismiss_notification_prompt(surface):
                continue
            skip=next((n for n in surface.iter("node") if match("app-opening-skip",n)),None)
            if skip is not None:
                touch(skip);time.sleep(1);continue
            for node in surface.iter("node"):
                if match(label, node) and node.get("enabled") != "false":
                    return node
        except (ET.ParseError, subprocess.SubprocessError):
            pass
        time.sleep(.5)
    # Only known UI markers are logged. Never dump account details/screens from login.
    labels = ("splash-start", "consent-continue", "phone-input", "otp-cell-0", "pilot-open-place",
              "Accueil", "Prix à préciser", "Sauvegardé", "Reload", "Dismiss", "Continue", "Continue without an account")
    surface=tree()
    labels += ("pilot-code-input", "pilot-code-submit", "Ouvrir la fiche", "Retrouver le lieu", "Continuer",
               "Entre les 12 caractères du code de reprise.", "Ce code a expiré ou a déjà été utilisé.",
               "Sauvegarde pour plus tard", "IN’ Concept Store", "carte-view-toggle", "permission_deny_button")
    present = [v for v in labels if any(match(v,n) for n in surface.iter("node"))]
    packages = sorted({n.get("package") for n in surface.iter("node") if n.get("package")})
    print("Android UI", {"wanted": label, "markers": present, "packages": packages}, flush=True)
    if "splash-start" in present and not any(n.get("class")=="android.widget.EditText" for n in surface.iter("node")):
        with (OUT/"diagnostic-accueil-anonyme.png").open("wb") as screen:
            subprocess.run(["adb","exec-out","screencap","-p"],stdout=screen,check=True)
    raise RuntimeError(f"Missing {label!r} ; observed UI markers {present!r}")

def touch(node):
    x1,y1,x2,y2=map(int,re.findall(r"-?\d+",node.attrib["bounds"]))
    adb("shell","input","tap",str((x1+x2)//2),str((y1+y2)//2))

def tap(label):
    touch(find(label))

def enter_resume_code(value):
    assert re.fullmatch(r"[0-9A-F]{12}", value)
    field = "pilot-code-input"
    tap(field)
    for attempt in range(4):
        typed = find(field).get("text", "").upper()
        if typed == value:
            adb("shell","input","keyevent","4")
            tap("pilot-code-submit")
            return
        if not value.startswith(typed):
            adb("shell", "input", "keycombination", "113", "29")
            adb("shell", "input", "keyevent", "67")
            typed = ""
        for ch in value[len(typed):]:
            adb("shell", "input", "text", ch)
            time.sleep(.15)
    raise RuntimeError("Le champ de reprise ne contient pas les douze caractères attendus")

def advance(control, destination):
    for attempt in range(4):
        tap(control)
        try:
            find(destination,7);return
        except RuntimeError:
            if attempt==3:raise

def journey(source):
    key=str(uuid.uuid4())
    for step in ("arrival","download_click"):
        body=dict(p_visit_key=key,p_action=step,p_source=source,p_medium="paid_social",
                  p_campaign="abidjan_beta_20261204",p_creative="pancakes_v2")
        req=urllib.request.Request("http://127.0.0.1:54321/rest/v1/rpc/pilot_campaign_touch",
            data=json.dumps(body).encode(),headers={"apikey":ANON,"Authorization":"Bearer "+ANON,"Content-Type":"application/json"})
        with urllib.request.urlopen(req,timeout=20) as response:
            result=json.load(response)
    return result

def login(account):
    advance("splash-start","consent-cgv");tap("consent-cgv");tap("consent-geoloc");tap("consent-continue")
    tap("phone-input"); adb("shell","input","text",account["phone"].removeprefix("+225"))
    adb("shell","input","keyevent","4"); tap("phone-send")
    for i,digit in enumerate("123456"):
        tap(f"otp-cell-{i}"); adb("shell","input","text",digit)

def proof(jid):
    jid=str(uuid.UUID(jid))
    sql=f"""select jsonb_build_object('journey',j.id,'source',j.source,'arrival_utc',j.arrived_at,
    'click_utc',j.clicked_at,'install_utc',i.installed_at,'first_open_utc',i.first_open_at,
    'claim_utc',j.claimed_at,'acquisition',j.acquisition,'population',p.population,'alias',p.alias,
    'actions',(select jsonb_agg(jsonb_build_object('event',a.kind,'at_utc',a.action_at,
    'ack_utc',a.received_at,'place',a.place_id,'applied',a.applied) order by a.action_at)
    from pilot_private.actions a where a.person=j.person))
    from pilot_private.journeys j left join pilot_private.installs i on i.id=j.install
    left join pilot_private.people p on p.person=j.person where j.id='{jid}'"""
    output=subprocess.check_output(["docker","exec",os.environ["PILOT_DB_CONTAINER"],"psql","-XAtq",
      "-U","postgres","-d","pilot_http","-c",sql],text=True)
    return json.loads(output)

def durable_add(jid):
    end=time.monotonic()+75
    while time.monotonic()<end:
        row=proof(jid)
        kinds=[a["event"] for a in row["actions"] or [] if a["place"]==BRUNCH and a["applied"]]
        if "place_viewed" in kinds and "saved_place_added" in kinds:
            assert kinds.index("place_viewed")<kinds.index("saved_place_added")
            return row
        time.sleep(1)
    raise RuntimeError("Favorite or view missing from server after UI gesture")

def scenario(source,account,mode):
    receipt={"source":source,"browser":"fixture HTTP et intent Android ou saisie manuelle",
             "build":45,"client":"debug x86_64 / même source, API isolée","os":"Android 15 API 35",
             "mode":mode,"started_at":now()}
    path=OUT/(mode+".json")
    def step(value):
        receipt["step"]=value;path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding="utf8")
    subprocess.run(["adb","uninstall",PACKAGE],capture_output=True)
    step("clic simulé sur la campagne de recette")
    j=journey(source);receipt["journey"]=j["journey_id"]
    time.sleep(1.5);adb("install","-r",APK,timeout=180)
    step("installation et première ouverture")
    if mode=="facebook":
        adb("shell","am","start","-W","-a","android.intent.action.VIEW","-c",
            "android.intent.category.BROWSABLE","-d","https://spawt.online/reprendre/"+j["resume_token"],"-p",PACKAGE)
    else:
        adb("shell","am","start","-W","-n",PACKAGE+"/.MainActivity")
        advance("pilot-enter-code","pilot-code-input")
        enter_resume_code(j["resume_code"])
    step("consentement et identification synthétique");login(account)
    find("pilot-open-place")
    row=proof(j["journey_id"])
    assert row["acquisition"] and row["population"]==("demo" if mode=="demo" else "interne")
    assert not row["actions"],"La proposition du lieu ne doit créer aucun geste"
    recording=None
    if mode=="demo":
        recording=subprocess.Popen(["adb","shell","screenrecord","--size","720x1440","--bit-rate","5000000",
          "--time-limit","110","/sdcard/pilot-demo.mp4"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        time.sleep(2)
    try:
        step("ouverture volontaire de IN’");tap("pilot-open-place")
        find("IN’ Concept Store");find("Prix à préciser")
        assert match("Sauvegarde pour plus tard",find("Sauvegarde pour plus tard"))
        time.sleep(1.5);step("appui sur le favori");tap("Sauvegarde pour plus tard");find("Sauvegardé")
        receipt["server"]=durable_add(j["journey_id"]);time.sleep(2)
        step("favori confirmé sur le serveur local")
    finally:
        if recording:
            pid=adb("shell","pidof","screenrecord").strip()
            if pid.isdigit():adb("shell","kill","-2",pid)
            recording.wait(timeout=25)
    if mode=="demo":
        adb("pull","/sdcard/pilot-demo.mp4",str(OUT/"Jean-Claude-demo-Android.mp4"))
        subprocess.run(["ffmpeg","-v","error","-i",str(OUT/"Jean-Claude-demo-Android.mp4"),
                        "-f","null","-"],check=True)

def map_probe():
    account=FIXTURES[2]
    subprocess.run(["adb","uninstall",PACKAGE],capture_output=True)
    adb("install","-r",APK,timeout=180)
    adb("shell","am","start","-W","-n",PACKAGE+"/.MainActivity")
    login(account);find("Accueil")
    initial=adb("shell","pidof",PACKAGE).strip()
    adb("logcat","-c")
    result={"entered_utc":now(),"catalogue":155,"markers":111,"source":"debug x86_64"}
    try:
        adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d","spawt://carte","-p",PACKAGE)
        find("carte-view-toggle",40)
        time.sleep(12)
        result["same_process"]=adb("shell","pidof",PACKAGE).strip()==initial
        result["controls"]=True
        with (OUT/"carte-155-lieux.png").open("wb") as screen:
            subprocess.run(["adb","exec-out","screencap","-p"],stdout=screen,check=True)
        tap("carte-view-toggle");find("carte-view-toggle");tap("carte-view-toggle")
        time.sleep(5)
        result["remount_same_process"]=adb("shell","pidof",PACKAGE).strip()==initial
        assert result["same_process"] and result["remount_same_process"]
    finally:
        logs=adb("logcat","-b","crash","-d")
        native=adb("logcat","-d","-s","MapLibre","Mbgl","ReactNativeJS","AndroidRuntime","libc","DEBUG")
        diagnostic=[line for line in (logs+"\n"+native).splitlines() if
                    re.search(r"FATAL|Fatal signal|Abort message|backtrace|#[0-9]{2} pc|Exception|MapLibre|maplibre|OutOfMemory",line)]
        (OUT/"carte-diagnostic.txt").write_text("\n".join(re.sub(r"https?://\S+","[URL]",line)[:600] for line in diagnostic[-180:]))
        result["crash_buffer"]=bool(re.search(r"FATAL EXCEPTION|Fatal signal|Abort message",logs))
        (OUT/"carte-processus.json").write_text(json.dumps(result,indent=2))

def check_upgrade():
    account=FIXTURES[2]
    legacy=os.environ["PILOT_LEGACY_APK"]
    outcome={"from":42,"to":45,"account":"interne","place":BRUNCH}
    try:
        subprocess.run(["adb","uninstall",PACKAGE],capture_output=True)
        adb("reverse","tcp:8081","tcp:8082");adb("install",legacy,timeout=180)
        adb("shell","am","start","-W","-n",PACKAGE+"/.MainActivity")
        login(account);find("Accueil")
        def place():
            adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d","spawt://place/"+BRUNCH,"-p",PACKAGE)
            find("IN’ Concept Store")
        expected=f"select count(*) from public.saved_places where spawter_id='{account['id']}' and place_id='{BRUNCH}'"
        def count():
            return subprocess.check_output(["docker","exec",os.environ["PILOT_DB_CONTAINER"],"psql","-XAtq",
                "-U","postgres","-d","pilot_http","-c",expected],text=True).strip()
        assert count()=="0", "The legacy favorite scenario requires an untouched synthetic persona"
        outcome["before_legacy_save"]=now()
        place()
        tap("Sauvegarde pour plus tard")
        find("Sauvegardé")
        outcome["legacy_ui_gesture_confirmed"]=now()
        for _ in range(30):
            if count()=="1":break
            time.sleep(1)
        assert count()=="1";outcome["legacy_server_ack"]=now()
        adb("shell","am","force-stop",PACKAGE);adb("reverse","tcp:8081","tcp:8081")
        adb("install","-r",APK,timeout=180);place();find("Sauvegardé")
        assert count()=="1";outcome["after_upgrade_favorite_visible"]=now()
        j=journey("facebook")
        adb("shell","am","start","-W","-a","android.intent.action.VIEW",
            "-d","https://spawt.online/reprendre/"+j["resume_token"],"-p",PACKAGE)
        find("pilot-open-place")
        outcome["server"]=proof(j["journey_id"])
        assert outcome["server"]["acquisition"] is False
    finally:
        adb("reverse","tcp:8081","tcp:8081")
        (OUT/"favori-mise-a-jour.json").write_text(json.dumps(outcome,ensure_ascii=False,indent=2))

if __name__ == "__main__":
    errors=[]
    try:map_probe()
    except Exception as error:errors.append("carte : "+str(error))
    try:check_upgrade()
    except Exception as error:errors.append("mise à jour : "+str(error))
    for source,account,mode in [("facebook",FIXTURES[0],"facebook"),("instagram",FIXTURES[1],"instagram"),
                                ("facebook",FIXTURES[3],"demo")]:
        try:scenario(source,account,mode)
        except Exception as error:
            errors.append(mode+": "+str(error))
    if errors:raise SystemExit("\n".join(errors))
