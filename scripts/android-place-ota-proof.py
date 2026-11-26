"""Receive the published JS update on the signed APK and photograph its public IN' venue."""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).with_name("pilot-android-qa")))
from native import BRUNCH, PACKAGE, adb, match, now, touch, tree

out = pathlib.Path("fiche-ota")
out.mkdir(exist_ok=True)
config = json.loads(pathlib.Path("documentation/android-place-ota-proof.json").read_text())
assert config["build"] == 48 and config["runtime"] == "1.1.7(48)"
with pathlib.Path(os.environ["PILOT_DEBUG_APK"]).open("rb") as file:
    assert hashlib.file_digest(file, "sha256").hexdigest() == config["sha256"]
authorized = json.loads(pathlib.Path("app/eas.json").read_text())["build"]["preview"]["env"]
origin = authorized["EXPO_PUBLIC_SUPABASE_URL"]
assert origin == "https://api.spawt.online"
def public(table):
    request = urllib.request.Request(origin + "/rest/v1/" + table, headers={"apikey": authorized["EXPO_PUBLIC_SUPABASE_ANON_KEY"]})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read())

labels_fr=json.loads(pathlib.Path("app/src/i18n/fr.json").read_text())["place"]
place, = public("places?select=name,hours&id=eq." + BRUNCH)
practical, = public("public_place_practical?select=website_url,contact_email,services,sources&place_id=eq." + BRUNCH)
menu = public("public_menu_items?select=name,price_xof&place_id=eq." + BRUNCH)
assert len(place["hours"]) == 7 and practical["website_url"] and practical["contact_email"] and len(practical["sources"]) >= 1
assert any(row["name"] == "Eggs Benedict" and row["price_xof"] == 7000 for row in menu)
screen_size = re.findall(r"(\d+)x(\d+)", adb("shell","wm","size"))[-1]
width, height = map(int, screen_size)
receipt = {"package": PACKAGE, "build": 48, "sha256": config["sha256"], "otaGroup": config["updateGroup"],
           "source": config["sourceCommit"], "runtime": config["runtime"], "screens": {}, "api": origin,
           "venue": place["name"], "publicMenuItems": len(menu), "sourceCount": len(practical["sources"])}

def record():
    (out / "recu.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2))

def swipe(up=True, fraction=.44):
    x=int(width*.5)
    top,bottom=.30,.30+fraction
    y1,y2=(bottom,top) if up else (top,bottom)
    adb("shell","input","swipe",x,int(height*y1),x,int(height*y2),460)
    time.sleep(.75)

def visible(identifier):
    for node in tree().iter("node"):
        if match(identifier,node):
            bounds=list(map(int,re.findall(r"\d+",node.get("bounds",""))))
            if len(bounds)==4 and bounds[3]-bounds[1]>3 and bounds[2]-bounds[0]>3:
                return node
    return None

def visit():
    adb("shell","am","start","-W","-a","android.intent.action.VIEW","-d","spawt://place/"+BRUNCH,"-p",PACKAGE)
    time.sleep(2)

def seek(label,limit=15):
    for _ in range(limit):
        found=visible(label)
        if found is not None:return found
        swipe()
    raise AssertionError("Contrôle public hors de la fiche : "+label)

def text_on_screen():
    return " ".join(n.get("text","")+" "+n.get("content-desc","") for n in tree().iter("node"))

def shot(name, checks):
    time.sleep(.65)
    dest=out/(name+".png")
    dest.write_bytes(subprocess.check_output(["adb","exec-out","screencap","-p"]))
    receipt["screens"][name]={"at":now(),"checks":checks,"sha256":hashlib.sha256(dest.read_bytes()).hexdigest()}
    record()

def find_grouped(check, attempts=10):
    for _ in range(attempts):
        labels=text_on_screen()
        if check(labels):return
        swipe(fraction=.26)
    raise AssertionError("Le contenu public attendu ne figure pas ensemble dans la vue.")

# The embedded 48 has never contained place-week-toggle. The newly published
# runtime must show it after the client's regular update check and cold restart.
record()
for launch in range(1,7):
    adb("shell","am","force-stop",PACKAGE)
    adb("shell","am","start","-W","-n",PACKAGE+"/.MainActivity")
    time.sleep(16 if launch>1 else 28)
    visit()
    try:
        toggle=seek("place-week-toggle",limit=4)
        break
    except AssertionError:
        continue
else:raise RuntimeError("L’APK publié n’a pas reçu l’interface de la mise à jour attendue")
receipt["visibleOnLaunch"]=launch
touch(toggle)
find_grouped(lambda text: all(labels_fr["day_"+day] in text for day in ("fri","sat")) and "02:00" in text)
shot("in-horaires",["vendredi","samedi","02:00"])
# Reopen the place to start from its normal initial scroll position.
adb("shell","input","keyevent","4");time.sleep(.7);visit()
seek("place-practical")
find_grouped(lambda text: labels_fr["official_site"] in text and practical["contact_email"] in text)
shot("in-preparer-visite",["Site officiel","courriel public"])
adb("shell","input","keyevent","4");time.sleep(.7);visit()
menu_tab=seek("place-tab-menu");touch(menu_tab);time.sleep(1.2)
def has_menu(text):
    normalized=re.sub(r"\s+", "", text).casefold()
    return any(row["price_xof"] and row["name"].casefold() in text.casefold() and str(row["price_xof"])+"fcfa" in normalized for row in menu)
find_grouped(has_menu, attempts=14)
shot("in-menu",["nom et prix d’un plat du menu public"])
receipt["pass"]=True
record()
