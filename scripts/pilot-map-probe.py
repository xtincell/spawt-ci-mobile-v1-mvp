"""Test the unchanged SpotsMap of the pinned Android client in an anonymous diagnostic route."""
import json, os, pathlib, re, subprocess, time, xml.etree.ElementTree as ET
package="com.upgraders.spawt"
out=pathlib.Path("map-proof");out.mkdir(exist_ok=True)
def adb(*args):
    return subprocess.check_output(["adb",*args],timeout=75).decode(errors="replace")
def pid():
    return subprocess.run(["adb","shell","pidof",package],text=True,capture_output=True).stdout.strip()
def tree():
    adb("shell","uiautomator","dump","/sdcard/map-ui.xml")
    return ET.fromstring(adb("exec-out","cat","/sdcard/map-ui.xml").strip())
def find(nodes,label):
    return next((n for n in nodes.iter("node") if n.get("resource-id")==label),None)
def tap(n):
    x,y,a,b=map(int,re.findall(r"\d+",n.get("bounds","")))
    adb("shell","input","tap",str((x+a)//2),str((y+b)//2))
def deep():
    adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d","spawt://diagnostic-carte","-p",package)
def ready():
    end=time.monotonic()+110
    while time.monotonic()<end:
        surface=tree();skip=find(surface,"app-opening-skip")
        if skip is not None:tap(skip);time.sleep(1);continue
        if find(surface,"carte-inventory-count") is not None and any("155" in n.get("text","")+n.get("content-desc","") for n in surface.iter("node")):return surface
        time.sleep(1)
    raise RuntimeError("Le catalogue de 155 lieux ne s’affiche pas")
def shot(name):
    with (out/(name+".png")).open("wb") as f:subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,check=True)
record={"build":int(os.environ["QA_VERSION"]),"android_api":35,"lieux":155,"positions":111}
adb("logcat","-c")
try:
    deep();ready();first=pid();time.sleep(7);shot("carte-initiale")
    surface=tree();toggle=find(surface,"carte-view-toggle")
    record.update(native_map=find(surface,"carte-mapview") is not None,toggle=toggle is not None,alive=bool(first and pid()==first))
    if toggle is not None:
        tap(toggle);time.sleep(3);shot("carte-liste");again=find(tree(),"carte-view-toggle")
        if again is not None:tap(again);time.sleep(3)
    adb("shell","input","keyevent","3");time.sleep(4);deep();ready();shot("carte-retour")
    record["resume_same_process"]=bool(first and first==pid())
    assert record["alive"] and record["resume_same_process"]
finally:
    shot("dernier-ecran")
    crash=adb("logcat","-b","crash","-d")
    log=adb("logcat","-d","-s","MapLibre","Mbgl","ReactNativeJS","AndroidRuntime","libc","DEBUG")
    lines=[s for s in (crash+"\n"+log).splitlines() if re.search(r"FATAL|Fatal signal|Abort message|backtrace|#[0-9]{2} pc|Exception|MapLibre|maplibre|OutOfMemory|Running .main.",s)]
    (out/"diagnostic-natif.txt").write_text("\n".join(re.sub(r"https?://\S+","[URL]",s)[:500] for s in lines[-150:]),encoding="utf8")
    record["fatal_buffer"]=bool(re.search(r"FATAL EXCEPTION|Fatal signal|Abort message",crash))
    (out/"resultat-carte.json").write_text(json.dumps(record,indent=2),encoding="utf8")
    try:(out/"interface.txt").write_text("\n".join(sorted(set(n.get("resource-id","") for n in tree().iter("node")))),encoding="utf8")
    except Exception:pass
