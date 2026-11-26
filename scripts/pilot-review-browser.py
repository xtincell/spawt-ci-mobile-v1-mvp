"""Validate a real browser tap into the signed APK. The link page contains only the public HTTPS URL."""
import datetime
import http.server
import json
import os
import pathlib
import re
import subprocess
import threading
import time
from urllib.parse import quote
import xml.etree.ElementTree as ET

APP="com.upgraders.spawt"
URL="https://spawt.online/ouvrir/avis/le-cha-alexandre"
ANDROID_CTA="intent://spawt.online/ouvrir/avis/le-cha-alexandre#Intent;scheme=https;package="+APP+";S.browser_fallback_url="+quote(URL+"#installer",safe="")+";end"
OUT=pathlib.Path("pilot-proof/le-cha");OUT.mkdir(parents=True,exist_ok=True)
REVIEW=json.loads(pathlib.Path(__file__).with_name("le-cha-review-build45.json").read_text(encoding="utf8"))
def adb(*args):
    return subprocess.check_output(["adb",*args],timeout=90).decode(errors="replace")
def tree():
    for _ in range(10):
        try:
            adb("shell","uiautomator","dump","/sdcard/review-ui.xml")
            serialized=adb("exec-out","cat","/sdcard/review-ui.xml").strip()
            return ET.fromstring(serialized)
        except (ET.ParseError,subprocess.SubprocessError):
            time.sleep(.6)
    raise RuntimeError("Android n'a pas fourni de hiérarchie d'accessibilité lisible")
def labels(n):
    return [n.get(k,"") for k in ("text","content-desc","resource-id")]
def click(n):
    x,y,a,b=map(int,re.findall(r"\d+",n.get("bounds","")))
    adb("shell","input","tap",str((x+a)//2),str((y+b)//2))
def shot(name):
    with (OUT/(name+".png")).open("wb") as f:subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,check=True)
def control(value, timeout=45):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        surface=tree()
        for node in surface.iter("node"):
            if node.get("resource-id") in ("com.android.permissioncontroller:id/permission_allow_button","com.android.permissioncontroller:id/permission_allow_foreground_only_button"):
                click(node)
                break
            if node.get("package")==APP and value in labels(node) and node.get("enabled")!="false":
                return node
        time.sleep(.5)
    raise RuntimeError("Contrôle natif attendu absent")
def signed_in():
    # Existing authorized QA account. It is used only to receive its own real session.
    adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d","spawt://phone","-p",APP)
    click(control("phone-input"));adb("shell","input","text","0000000193")
    adb("shell","input","keyevent","4");click(control("phone-send"))
    for i,digit in enumerate("123456"):
        click(control("otp-cell-"+str(i)));adb("shell","input","text",digit)
    control("Accueil")
class Entry(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        raw=('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette SPAWT</title>'
             '<a style="font:24px sans-serif;display:block;padding:40px" href="'+ANDROID_CTA+'">Lire le commentaire Le Cha</a>').encode()
        self.send_response(200);self.send_header("Content-Type","text/html; charset=utf-8");self.send_header("Content-Length",len(raw));self.end_headers();self.wfile.write(raw)
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(("127.0.0.1",8765),Entry)
threading.Thread(target=server.serve_forever,daemon=True).start()
adb("reverse","tcp:8765","tcp:8765")
plain="http://127.0.0.1:8765/"
browser=adb("shell","cmd","package","resolve-activity","--brief","-a","android.intent.action.VIEW","-c","android.intent.category.BROWSABLE","-d",plain).strip().splitlines()[-1].split("/")[0]
if not re.match("[a-z][a-z0-9_.]+$",browser) or browser in (APP,"android"):raise RuntimeError("No default Android browser")
record={"build":45,"source":"bouton Android de production depuis une page de recette Chrome","href":ANDROID_CTA,"os":adb("shell","getprop","ro.build.version.release").strip(),"browser":browser,"url":URL,"checks":[]}
m=re.search(r"versionName=(\S+)",adb("shell","dumpsys","package",browser))
record["browser_version"]=m.group(1) if m else None
def enter(kind):
    if kind=="cold":adb("shell","am","force-stop",APP)
    before=subprocess.run(["adb","shell","pidof",APP],capture_output=True,text=True).stdout.strip()
    adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d",plain+kind,"-p",browser)
    deadline=time.monotonic()+100
    visible_since=None
    while time.monotonic()<deadline:
        surface=tree()
        button=next((n for n in surface.iter("node") if "Lire le commentaire Le Cha" in labels(n)),None)
        if button is not None:
            if visible_since is None:
                visible_since=time.monotonic()
                time.sleep(1)
                continue
            if time.monotonic()-visible_since > 1:
                click(button)
                break
        onboarding=("Use without an account","Use Chrome without an account","Continue without an account","No thanks","Accept & continue","Got it","Not now","Continue")
        action=next((n for name in onboarding for n in surface.iter("node") if name in labels(n)),None)
        if action is not None:click(action)
        time.sleep(.8)
    else:raise RuntimeError("Le lien de recette n’est pas accessible dans "+browser)
    target={"title":"le-cha-review-title","quote":"le-cha-review-comment","photo":"le-cha-review-photo"}
    observed={};notes=set();top=False
    for attempt in range(24):
        surface=tree()
        link=next((n for n in surface.iter("node") if n.get("package")==browser and "Lire le commentaire Le Cha" in labels(n)),None)
        if link is not None and attempt in (2,6):
            click(link)
            time.sleep(1)
            continue
        if any("le-cha-review-title" in labels(n) for n in surface.iter("node")):
            if not top:shot(kind+"-commentaire");top=True
        for n in surface.iter("node"):
            if n.get("package")!=APP:continue
            values=labels(n)
            for key,identifier in target.items():
                if identifier in values:observed[key]=[n.get("text",""),n.get("content-desc","")]
            for v in [r["label"]+" "+str(r["value"])+"/5" for r in REVIEW["ratings"]]:
                if v in values:notes.add(v)
        if observed.get("photo") and observed.get("quote") and len(notes)==3:
            shot(kind+"-photo");break
        if top:adb("shell","input","swipe","520","1550","520","650","450")
        time.sleep(1)
    assert REVIEW["name"] in observed.get("title",[]) and REVIEW["quote"] in observed.get("quote",[]), "Titre et commentaire incomplets"
    assert REVIEW["photoAlt"] in observed.get("photo",[]) and len(notes)==3, "Photo ou notes manquantes"
    after=adb("shell","pidof",APP).strip()
    assert after and ((not before) if kind=="cold" else before==after)
    return {"state":kind,"at_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),"title":REVIEW["name"],"quote":True,"photo":True,"ratings":sorted(notes),"process_verified":True}
safe_to_capture=True
try:
    record["checks"].append(enter("cold"))
    safe_to_capture=False
    signed_in()
    safe_to_capture=True
    record["signedInBeforeWarm"]=True
    record["checks"].append(enter("warm"))
finally:
    (OUT/"recu-navigation.json").write_text(json.dumps(record,ensure_ascii=False,indent=2))
    if safe_to_capture:shot("dernier-ecran")
    (OUT/"ids-interface.txt").write_text("\n".join(sorted(set(n.get("resource-id","") for n in tree().iter("node")))))
