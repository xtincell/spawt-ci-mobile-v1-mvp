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
    return any(node.get(k, "").casefold() == label.casefold() or
               node.get(k, "").endswith(":id/" + label) for k in ("text", "resource-id", "content-desc"))

def find(label, timeout=70):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        try:
            for node in tree().iter("node"):
                if match(label, node) and node.get("enabled") != "false":
                    return node
        except (ET.ParseError, subprocess.SubprocessError):
            pass
        time.sleep(.5)
    # Only known UI markers are logged. Never dump account details/screens from login.
    labels = ("splash-start", "consent-continue", "phone-input", "otp-cell-0", "pilot-open-place",
              "Accueil", "Prix à préciser", "Sauvegardé", "Reload", "Dismiss", "Continue", "Continue without an account")
    present = [v for v in labels if any(match(v,n) for n in tree().iter("node"))]
    raise RuntimeError(f"Missing {label!r} ; observed UI markers {present!r}")

def tap(label):
    node=find(label)
    x1,y1,x2,y2=map(int,re.findall(r"-?\d+",node.attrib["bounds"]))
    adb("shell","input","tap",str((x1+x2)//2),str((y1+y2)//2))

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
    tap("splash-start"); tap("consent-cgv"); tap("consent-geoloc"); tap("consent-continue")
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
             "build":43,"client":"debug x86_64 / même source, API isolée","os":"Android 15 API 35",
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
        tap("pilot-enter-code");tap("pilot-code-input");adb("shell","input","text",j["resume_code"])
        adb("shell","input","keyevent","4");tap("pilot-code-submit")
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

errors=[]
for source,account,mode in [("facebook",FIXTURES[0],"facebook"),("instagram",FIXTURES[1],"instagram"),
                            ("facebook",FIXTURES[3],"demo")]:
    try:scenario(source,account,mode)
    except Exception as error:
        errors.append(mode+": "+str(error))
if errors:raise SystemExit("\n".join(errors))
