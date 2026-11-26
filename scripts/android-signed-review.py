"""Read the candidate's individual review on the actual signed APK, after its ordinary opening checks."""
import hashlib
import json
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

folder = pathlib.Path("android-proof")
config = json.loads(pathlib.Path("documentation/android-qa.json").read_text())
data = json.loads(pathlib.Path("app/src/data/le-cha-review.json").read_text())
package = "com.upgraders.spawt"
url = "https://spawt.online/ouvrir/avis/le-cha-alexandre"
def adb(*args):
    return subprocess.check_output(["adb",*args],timeout=45).decode(errors="replace").strip()
def hierarchy():
    adb("shell","uiautomator","dump","/sdcard/signed-review.xml")
    return ET.fromstring(adb("exec-out","cat","/sdcard/signed-review.xml"))
adb("shell","pm","grant",package,"android.permission.POST_NOTIFICATIONS")
metadata = json.loads((folder/"apk-metadata.json").read_text())
out = {"build": config["build"], "sha256": metadata["sha256"], "url":url,
       "transport":"explicit HTTPS Android intent targeting the installed package", "states":[]}
for state in ("cold","warm"):
    if state == "cold":
        adb("shell","am","force-stop",package)
    previous = subprocess.run(["adb","shell","pidof",package],capture_output=True,text=True).stdout.strip()
    adb("shell","am","start","-W","-a","android.intent.action.VIEW","-c","android.intent.category.BROWSABLE","-d",url,"-p",package)
    deadline = time.monotonic()+55
    while time.monotonic()<deadline:
        try:
            nodes = [node for node in hierarchy().iter("node") if node.get("package")==package]
        except (ET.ParseError,subprocess.SubprocessError):
            continue
        def with_id(key):
            return next((n for n in nodes if n.get("resource-id","").split("/")[-1]==key),None)
        title,quote,photo = (with_id("le-cha-review-"+key) for key in ("title","comment","photo"))
        if title is None or quote is None or photo is None:
            time.sleep(.4)
            continue
        assert title.get("text")==data["name"] and quote.get("text")==data["quote"]
        assert photo.get("content-desc")==data["photoAlt"]
        a,b,c,d=map(int,re.findall(r"-?\d+",photo.get("bounds","")))
        assert abs((c-a)/(d-b)-.75)<.025, "Photo not shown in its original 3:4 ratio"
        notes=[x["label"]+" "+str(x["value"]).replace(".",",")+"/5" for x in data["ratings"]]
        assert all(any(note in node.get("content-desc","") for node in nodes) for note in notes)
        assert any(data["author"].casefold()==n.get("text","").casefold() for n in nodes) and data["author"]=="Membre de la Bande"
        pixels = subprocess.check_output(["adb","exec-out","screencap","-p"])
        (folder/("le-cha-"+state+".png")).write_bytes(pixels)
        pid=adb("shell","pidof",package)
        assert pid and (not previous if state=="cold" else previous==pid)
        out["states"].append({"state":state,"title":data["name"],"quote":True,"author":any(data["author"].casefold()==n.get("text","").casefold() for n in nodes),
            "photoAspectRatio":(c-a)/(d-b),"ratings":notes,"processVerified":True,"screenshotSha256":hashlib.sha256(pixels).hexdigest()})
        break
    else: raise RuntimeError("Le Cha not completely visible in signed candidate, "+state)
(folder/"le-cha-signed.json").write_text(json.dumps(out,ensure_ascii=False,indent=2))
