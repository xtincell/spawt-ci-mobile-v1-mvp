#!/usr/bin/env python3
"""Recette ADB sur deux comptes synthétiques alpha ; captures, XML et assertions.
Le SDK doit être prêt et l'APK installée. Aucune clé serveur ni session n'est journalisée.
"""
import os, re, json, time, pathlib, subprocess, sys, xml.etree.ElementTree as ET, urllib.request
MODE=os.environ.get('SPAWT_QA_MODE','observe')
if MODE=='pitch':
    # Install before reading account/configuration values. An uncaught error
    # (including bootstrap or finally) must not expose its command, URL, UI
    # anchor or traceback in public CI logs. The workflow seals these files.
    def pitch_exception_hook(kind,value,tb):
        try:
            import traceback
            diagnostic=pathlib.Path('android-proof/pitch-exception.txt')
            diagnostic.parent.mkdir(exist_ok=True)
            diagnostic.write_text(''.join(traceback.format_exception(kind,value,tb)))
        except BaseException: pass
        try: print('PITCH execution: erreur',file=sys.stderr,flush=True)
        except BaseException: pass
    sys.excepthook=pitch_exception_hook
    sys.unraisablehook=lambda event:pitch_exception_hook(event.exc_type,event.exc_value,event.exc_traceback)
OUT=pathlib.Path('android-proof'); OUT.mkdir(exist_ok=True)
PACKAGE='com.upgraders.spawt'; PLACE='a1000000-0000-4000-8000-000000000004'
PHONE=os.environ['SPAWT_QA_PHONE']
OWNER={'+2250000000101':'fc8bc9b3-0bbb-447f-85a3-fe4bc0d4ed05','+2250000000193':'d7ea30bc-fb7f-440d-bac6-4bbd306f1e42','+2250000000194':'dca6b8a2-0c57-4adb-8858-93736370d3ed'}[PHONE]
RESULTS=[]
RUN=os.environ.get('GITHUB_RUN_ID',str(int(time.time())))
MARKER='Recette native SPAWT 1.1.1 '+RUN

def adb(*args, binary=False):
    r=subprocess.run(['adb','-s',os.environ.get('SPAWT_QA_SERIAL','emulator-5554'),*map(str,args)],capture_output=True,check=True,timeout=40)
    return r.stdout if binary else r.stdout.decode(errors='replace')

def nodes():
    raw=''
    for _ in range(3):
        adb('shell','rm','-f','/sdcard/window.xml')
        dump=adb('shell','uiautomator','dump','/sdcard/window.xml')
        raw=adb('exec-out','cat','/sdcard/window.xml')
        if raw.lstrip().startswith('<?xml'):
            return ET.fromstring(raw),raw
        (OUT/'ui-dump-error.txt').write_text(dump+'\n'+raw)
        time.sleep(.6)
    raise RuntimeError('Android UI hierarchy unavailable' if MODE=='pitch' else 'Android UI hierarchy unavailable: '+raw[:250])

def label(n): return n.get('text','')+' '+n.get('content-desc','')+' '+n.get('resource-id','')

def find(value, timeout=25, exact=False, enabled=False):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        tree,_=nodes()
        for n in tree.iter('node'):
            if (any(n.get(k,'').casefold()==value.casefold() for k in ['text','content-desc','resource-id']) if exact else value.casefold() in label(n).casefold()):
                if enabled and n.get('enabled') != 'true': continue
                b=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
                if len(b)==4 and b[2]>b[0] and b[3]>b[1]: return n
        time.sleep(.4)
    raise AssertionError('Native control not found' if MODE=='pitch' else 'Native control not found: '+value)

def tap_node(n):
    b=list(map(int,re.findall(r'\d+',n.get('bounds','')))); assert len(b)==4
    adb('shell','input','tap',(b[0]+b[2])//2,(b[1]+b[3])//2)

def tap(value, timeout=25, exact=False): tap_node(find(value,timeout,exact))
def deep(path):
    result=adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','spawt://'+path,PACKAGE)
    with (OUT/'navigation.txt').open('a') as log: log.write(path+'\n'+result+'\n')
    time.sleep(1.2)

def restart():
    # Même geste qu'une réouverture depuis le launcher : laisser la session
    # se restaurer avant de naviguer. Un intent froid peut restaurer la tâche
    # Android sur son dernier onglet ; ce n'est pas le parcours testé ici.
    adb('shell','am','force-stop',PACKAGE)
    adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
    find('Accueil',timeout=40,exact=True)
def snap(name):
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))
    tree,raw=nodes(); (OUT/(name+'.xml')).write_text(raw)
    texts=[n.get('text') or n.get('content-desc') for n in tree.iter('node') if n.get('text') or n.get('content-desc')]
    if MODE=='pitch':
        public_id=name if name in ('cold-opening','signed-in','last-state','pitch-00-onboarding','pitch-00-phone') else 'snapshot'
        print('PITCH '+public_id+': capturé',flush=True)
    else: print(name+': '+ ' | '.join(texts)[:1200],flush=True)
    if MODE in ('full','matrix','photos'):
        check(name+': labels translated',not any('a11y.stars' in text or 'review.section_photos' in text.casefold() for text in texts))
    return tree

def bounds(n): return list(map(int,re.findall(r'\d+',n.get('bounds',''))))

def public_reviews(owner=OWNER):
    cfg=json.loads(pathlib.Path('app/eas.json').read_text())['build']['preview']['env']
    url=cfg['EXPO_PUBLIC_SUPABASE_URL']+'/rest/v1/public_reviews?select=id,texte_avis,note_cuisine,note_cadre,note_service,note_globale,photos,avatar_url&spawter_id=eq.'+owner
    req=urllib.request.Request(url,headers={'apikey':cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY'],'User-Agent':'SPAWT-Android-QA'})
    with urllib.request.urlopen(req,timeout=25) as response: return json.load(response)

def check(name, ok):
    RESULTS.append({'check':name,'passed':bool(ok)})
    public_name=name
    if MODE=='pitch' and name not in (
            'pitch: original build42 provenance','pitch: existing synthetic account',
            'pitch: published APK42 SHA256','pitch: installed version42',
            'pitch: background location not granted',
            'cold animated launch keeps SPAWT in foreground',
            'pitch: authenticated native home available'):
        public_name='pitch: check-'+str(len(RESULTS))
    print('ASSERT '+public_name+': '+('PASS' if ok else 'FAIL'),flush=True)
    assert ok,public_name

def geometry(width,scale,pixel_ratio=3):
    adb('shell','wm','size',f'{width*pixel_ratio}x{800*pixel_ratio}'); adb('shell','wm','density',str(160*pixel_ratio))
    adb('shell','settings','put','system','font_scale',scale); time.sleep(1)

def login(phone):
    deep('phone'); tap('phone-input'); adb('shell','input','text',phone.removeprefix('+225'))
    adb('shell','input','keyevent','4')
    tap_node(find('phone-send',enabled=True))
    # Le formulaire attend au plus 30 s avant d'afficher une erreur réseau.
    # Attendre au-delà de ce délai garde le diagnostic réel dans last-state.
    find('otp-cell-0',timeout=45)
    for i,digit in enumerate('123456'):
        tap(f'otp-cell-{i}'); adb('shell','input','text',digit)
    find('Accueil',timeout=40,exact=True)
    time.sleep(1)

def home():
    deep(''); find('Accueil',exact=True)

def back(): adb('shell','input','keyevent','4'); time.sleep(.5)

def scroll_find(value, attempts=6):
    for _ in range(attempts):
        try:
            candidate=find(value,timeout=2)
            tree,_=nodes()
            # UIAutomator peut annoncer un enfant du ScrollView derrière le
            # pied fixe. Ne pas taper sa position tant qu'elle est recouverte.
            footers=[bounds(n)[1] for n in tree.iter('node') if n.get('resource-id') in ('review-submit','place-start-review')]
            limit=min(footers) if footers else 2320
            if bounds(candidate)[3] <= limit-8: return candidate
        except AssertionError: pass
        scroll()
    raise AssertionError('Native control absent after scroll' if MODE=='pitch' else 'Native control absent after scroll: '+value)

def scroll_tap(value): tap_node(scroll_find(value))

def scroll(): adb('shell','input','swipe','550','1500','550','550','350'); time.sleep(.6)

def contribution_receipt():
    # Sending resets the photo form and moves the receipt above the retained
    # scroll offset. Do not scroll down while the upload is still in flight.
    try:
        find('contribution-receipt',timeout=30)
        return
    except AssertionError:
        for _ in range(9):
            adb('shell','input','swipe','550','550','550','1600','200')
            time.sleep(.2)
        scroll_find('contribution-receipt',attempts=12)

def rate():
    for key,n in [('cuisine',5),('cadre',4),('service',4)]: scroll_tap(f'review-note_{key}-{n}')

def write_review(text):
    scroll_tap('review-text'); adb('shell','input','text',text.replace(' ','%s')); back()

def twice(value):
    b=bounds(find(value)); x=(b[0]+b[2])//2; y=(b[1]+b[3])//2
    adb('shell',f'input tap {x} {y}; input tap {x} {y}')

def pick_test_photo(name):
    snap(name+'-picker')
    tree,_=nodes()
    candidates=[n for n in tree.iter('node') if
        'icon_thumbnail' in n.get('resource-id','') or
        'spawt-qa.png' in label(n) or
        n.get('content-desc','').lower().startswith('photo taken')]
    if not candidates:
        raise AssertionError('Test image not exposed by Android picker; inspect '+name+'-picker.xml')
    tap_node(candidates[0]); time.sleep(.7)

def wait_public(text):
    end=time.monotonic()+50
    while time.monotonic()<end:
        rows=[r for r in public_reviews() if r['texte_avis']==text]
        if rows: return rows
        time.sleep(1)
    raise AssertionError('Native publication not received by server: '+text)

def photo_and_network_cases():
    photo_text='Recette photo SPAWT 1.1.1 '+RUN
    queued_text='Recette reseau SPAWT 1.1.1 '+RUN
    adb('shell','mkdir','-p','/sdcard/Pictures')
    adb('push','app/assets/icon.png','/sdcard/Pictures/spawt-qa.png')
    adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Pictures/spawt-qa.png')
    home(); tap('Palais',exact=True); find('Recette Android'); snap('moka-default-profile')
    tap('Changer ma photo de profil'); tap('Prendre une photo',exact=True)
    tap('permission_deny_button'); find('Autorisation requise'); snap('camera-denied'); tap('OK',exact=True)
    check('camera refusal remains actionable',True)
    deep('place/'+PLACE); twice('place-start-review'); rate(); write_review(photo_text)
    scroll_find('review-photo-add'); snap('before-photo-picker'); scroll_tap('review-photo-add'); pick_test_photo('review')
    find('review-photo-0'); snap('selected-photo-preview')
    adb('shell','cmd','connectivity','airplane-mode','enable')
    tap('review-submit')
    find('Avis non envoyé',timeout=15); snap('failed-upload-receipt'); tap('OK',exact=True)
    scroll_find('review-photo-0'); snap('failed-upload-keeps-photo')
    check('failed upload does not publish',not any(r['texte_avis']==photo_text for r in public_reviews()))
    adb('shell','cmd','connectivity','airplane-mode','disable')
    time.sleep(2); restart()
    deep('place/'+PLACE); tap('place-start-review'); scroll_find('review-photo-0'); snap('photo-draft-after-restart')
    check('photo draft survives process restart',True)
    twice('review-submit'); find('Avis publié',timeout=50); snap('photo-published'); tap('OK',exact=True)
    rows=wait_public(photo_text)
    check('single photo review with 4.3',len(rows)==1 and rows[0]['note_globale']==4.3 and len(rows[0]['photos'])==1)
    # Lien signé demandé avec les droits publics, jamais une clé serveur.
    cfg=json.loads(pathlib.Path('app/eas.json').read_text())['build']['preview']['env']; base=cfg['EXPO_PUBLIC_SUPABASE_URL']
    path=rows[0]['photos'][0]
    req=urllib.request.Request(base+'/storage/v1/object/sign/place-photos/'+path,data=json.dumps({'expiresIn':60}).encode(),headers={'apikey':cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY'],'Authorization':'Bearer '+cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY'],'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=25) as response: signed=json.load(response)['signedURL']
    with urllib.request.urlopen(base+'/storage/v1'+signed,timeout=25) as response: photo=response.read()
    check('private review photo resolves through signed URL',photo[:2]==b'\xff\xd8' and len(photo)>1000)
    deep('place/'+PLACE); tap('place-start-review'); rate(); write_review(queued_text)
    adb('shell','cmd','connectivity','airplane-mode','enable')
    twice('review-submit'); find('Avis en attente d’envoi',timeout=50)
    check('queued receipt is truthful before reconnect',not any(r['texte_avis']==queued_text for r in public_reviews()))
    # Retour avant le backoff de 5 s : la relance doit fonctionner sans autre geste.
    adb('shell','cmd','connectivity','airplane-mode','disable')
    snap('queued-receipt'); tap('OK',exact=True)
    rows=wait_public(queued_text); check('queued review automatically delivered once',len(rows)==1 and rows[0]['note_globale']==4.3)
    home(); tap('Palais',exact=True); tap('Changer ma photo de profil'); tap('Choisir dans la galerie',exact=True)
    pick_test_photo('avatar'); snap('avatar-crop')
    tap('crop_image_menu_crop'); time.sleep(3); snap('personal-photo-profile')
    find('spawtercard-avatar-photo')
    check('personal avatar persisted',any(r['avatar_url'] for r in wait_public(photo_text)))
    # Autre compte natif, avec stockage local entièrement neuf.
    adb('shell','pm','clear',PACKAGE); login('+2250000000194')
    home(); tap('Palais',exact=True); find('Recette Android 1.1.1 B'); snap('second-account-moka')
    deep('place/'+PLACE); scroll_tap('Avis'); scroll_find('Alexandre',attempts=10); tree=snap('founder-public-author')
    check('founder publicly displays Alexandre',any('Alexandre' in label(n) for n in tree.iter('node')) and not any('Mission 1' in label(n) for n in tree.iter('node')))
    scroll_find(photo_text); scroll_find('Photo jointe à cet avis'); snap('photo-review-from-second-account')
    check('published review readable from another native account',True)
    # Vérifier aussi l'ouverture animée avec une session restaurée. La matrice
    # utilise ensuite la réduction système des animations pour ses captures.
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,1)
    restart(); snap('normal-opening-signed-in')
    check('animated opening restores signed-in account',True)
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,0)

def fully_visible_profile_link(tree, value):
    # The profile receipt runs at 3x density. Require a 44dp touch target and
    # its visible text inside the real ScrollView, not a clipped AX sliver.
    for viewport in tree.iter('node'):
        if viewport.get('class')!='android.widget.ScrollView': continue
        clip=bounds(viewport)
        for node in viewport.iter('node'):
            if node.get('class')!='android.widget.Button' or node.get('content-desc')!=value: continue
            b=bounds(node)
            if not (len(b)==4 and b[2]>b[0] and b[3]-b[1]>=132
                    and clip[1]<=b[1]<b[3]<=clip[3]): continue
            if any(child.get('text')==value and bounds(child)[3]-bounds(child)[1]>=48
                   and b[1]<=bounds(child)[1]<bounds(child)[3]<=b[3]
                   for child in node.iter('node')): return node
    return None

def raccordements_cases():
    """Candidate receipt only; console moderation and physical Guet stay unreceived."""
    from android_outing_qa import run_outing_cases
    outing=run_outing_cases(globals())
    fr=json.loads(pathlib.Path('app/src/i18n/fr.json').read_text())
    retired_gold=('+3 axes débloqués avec Spawter Gold (bientôt)',
                  'Spawter Gold actif','Gérer mon abonnement','profile-gold-indicator')
    def inspect(name):
        tree=snap(name)
        text='\n'.join(label(n).casefold() for n in tree.iter('node'))
        check(name+': no data read error',fr['common']['data_read_error'].casefold() not in text)
        check(name+': no retired Gold teaser',not any(term.casefold() in text for term in retired_gold))
        return tree

    geometry(393,1); home(); tap('home-mode-suggestions')
    scroll_find('home-personalized-feed',attempts=16); inspect('raccordements-home')
    deep('search'); tree,_=nodes()
    # The earlier outings case searched for a dish. Clear any retained query.
    if any(fr['common']['clear']==n.get(k,'') for n in tree.iter('node') for k in ('text','content-desc')):
        tap(fr['common']['clear'],exact=True)
    find('Cherche un spawt')
    tree,_=nodes(); field=next(n for n in tree.iter('node') if n.get('class')=='android.widget.EditText')
    tap_node(field)
    adb('shell','input','text','Grande'); back(); find('La Grande République')
    inspect('raccordements-search')
    tap('La Grande République'); find('place-start-review'); find('La Grande République')
    inspect('raccordements-place')

    home(); tap('Palais',exact=True); card=bounds(scroll_find('spawtercard'))
    inspect('raccordements-profile-recto')
    # The avatar owns the centre of the recto. Flip below it, using live bounds.
    adb('shell','input','tap',(card[0]+card[2])//2,card[3]-48); time.sleep(.8)
    verso=inspect('raccordements-profile-verso')
    poles=[fr['axis'][key] for key in ('racines','horizons','taniere','nomade',
          'exigeant','enthousiaste','foule','secret','maquis','table')]
    exposed=[pole for pole in poles if any(pole.casefold()==n.get(k,'').strip().casefold()
             for n in verso.iter('node') for k in ('text','content-desc'))]
    # Both card faces stay mounted, and Android may group their accessibility.
    # XML labels alone do not prove the five bars are visibly on the verso.
    for page in range(12):
        tree=inspect('raccordements-profile-scroll-'+str(page))
        settings_link=fully_visible_profile_link(tree,fr['profile']['link_settings'])
        if settings_link is not None: break
        scroll()
    else: raise AssertionError('Profile inspection did not reach the settings link')
    check('native profile inspected from card through its settings link',True)
    receipt={'mode':'raccordements','fullLiveReceipt':False,'outings':outing,
             'homeCatalogueRead':True,'placeSearchRead':True,'placeOpenedFromSearch':True,
             'profileLegacyGoldCopyAbsent':True,'profileAxisLabelsExposed':exposed,
             'profileVersoCapture':'raccordements-profile-verso.png',
             'profileSettingsCapture':'raccordements-profile-scroll-'+str(page)+'.png',
             'profileSettingsBounds':bounds(settings_link),'profileSettingsLabelVisible':True,
             'axesRequireVisualReview':True,'consoleModerationReceipt':False,
             'physicalGuetReceipt':False,
             'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    (OUT/'raccordements-data.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))

def live_content_cases():
    """Read actual public records, exercise native network failure, receive private feedback."""
    cfg=json.loads(pathlib.Path('app/eas.json').read_text())['build']['preview']['env']
    build=json.loads(pathlib.Path('documentation/android-qa.json').read_text())['build']
    expected_checks=7 if build>=41 else 5
    def read(path):
        req=urllib.request.Request(cfg['EXPO_PUBLIC_SUPABASE_URL']+'/rest/v1/'+path,headers={'apikey':cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY']})
        with urllib.request.urlopen(req,timeout=25) as r: return json.load(r)
    editorial=read('public_editorial_reviews?select=place_id,body&limit=1')[0]
    collections=read('explore_collections?select=slug,title_key&is_published=eq.true&audience=eq.general&order=sort_order&limit=1')
    announcements=read('public_announcements?select=title&order=starts_at.desc&limit=1')
    for width,scale in [(360,1),(393,1),(320,1.3)]:
        geometry(width,scale); home(); find('Choisir vite'); time.sleep(2)
        tree=snap(f'live-home-{width}-{scale}')
        check(f'{width}-{scale}: home feed has no read error', not any('pas pu charger' in label(n) for n in tree.iter('node')))
    geometry(393,1)
    inventory=read('places?select=id,name,lat,lng,price_tier&is_published=eq.true&limit=1000')
    mapped=sum(1 for place in inventory if place['lat'] is not None and place['lng'] is not None)
    deep('carte'); find(f'{len(inventory)} lieux · {mapped} sur la carte',timeout=30)
    snap('live-catalogue-map'); check('native map counts match all public records and known coordinates',True)
    tap('carte-filter-mine'); find('0 lieux · 0 sur la carte'); check('team catalogue does not populate personal spawts',True)
    tap('carte-filter-unexplored'); find(f'{len(inventory)} lieux · {mapped} sur la carte')
    tap('carte-view-toggle'); snap('live-catalogue-list'); check('unexplored public records are accessible in native list',True)
    documentary=next(place for place in inventory if place['lat'] is None and place['price_tier'] is None)
    deep('place/'+documentary['id']); find(documentary['name']); scroll_find('Pas encore noté'); scroll_find('Prix à préciser')
    snap('live-unrated-documentary'); check('native documentary place keeps unknown price and no rating',True)
    deep('actualites')
    find(announcements[0]['title'] if announcements else 'Pas de nouvelle publication pour le moment.')
    snap('live-announcements'); check('native announcements match public database',True)
    deep('place/'+editorial['place_id']); scroll_find(editorial['body'][:70],attempts=22)
    snap('live-editorial'); check('native editorial matches exact public database text',True)
    deep('explore'); find(collections[0]['title_key']); snap('live-collections')
    deep('explore/'+collections[0]['slug']); find(collections[0]['title_key']); snap('live-collection-detail')
    check('native collection index and detail match public database',True)
    deep('settings'); scroll_tap('Aide et retours'); tap('support-check')
    find('support-check-sync',timeout=30)
    tree=snap('live-content-checks')
    check_nodes=[n for n in tree.iter('node') if n.get('resource-id','').startswith('support-check-')]
    check('all native content checks reached production',len(check_nodes)==expected_checks and all('ndisponible' not in label(n) for n in check_nodes))
    # The same published binary must report a real outage and recover.
    adb('shell','cmd','connectivity','airplane-mode','enable'); adb('shell','svc','wifi','disable'); adb('shell','svc','data','disable')
    tap('support-check'); time.sleep(18)
    tree=snap('live-offline-checks'); failed=[n for n in tree.iter('node') if n.get('resource-id','').startswith('support-check-')]
    check('offline checks do not pretend data is empty',len(failed)==expected_checks and all('ndisponible' in label(n) for n in failed))
    scroll_tap('support-message'); adb('shell','input','text',MARKER.replace(' ','%s')); back()
    scroll_tap('support-send'); find('support-send-error',timeout=25); snap('live-feedback-offline')
    check('offline feedback remains unconfirmed',True)
    adb('shell','cmd','connectivity','airplane-mode','disable'); adb('shell','svc','wifi','enable'); adb('shell','svc','data','enable'); time.sleep(4)
    restart(); deep('support'); scroll_find('support-message')
    check('private feedback draft survives process restart',MARKER in label(find('support-message')))
    scroll_tap('support-send'); find('support-receipt',timeout=30); snap('live-feedback-received')
    check('native feedback receives server receipt',True)
    # The external console recipe responds using staff rights, never inside this APK.
    end=time.monotonic()+180
    while time.monotonic()<end:
        deep('settings'); deep('support'); scroll_tap('support-refresh'); time.sleep(2)
        try:
            scroll_find('Réponse équipe '+RUN,attempts=5); break
        except AssertionError: time.sleep(3)
    else: raise AssertionError('Private team reply was not received from the admin panel')
    snap('live-feedback-team-reply'); check('native feedback reads admin team reply',True)
    deep('settings'); deep('support'); tap('support-check'); find('support-check-sync',timeout=30)
    tree=snap('live-content-recovered'); check('native content reads recover after network outage',not any('ndisponible' in label(n) for n in tree.iter('node')))
    build=json.loads(pathlib.Path('documentation/android-qa.json').read_text())['build']
    enrichment={}
    if build>=39:
        deep('progression'); scroll_find('paws-balance',attempts=22)
        balance_before=int(find('paws-balance').get('text'))
        # An explicit technical image exercises native file bytes and private
        # moderation without ever publishing a fake menu on a real place.
        adb('shell','mkdir','-p','/sdcard/Pictures')
        adb('push','app/assets/icon.png','/sdcard/Pictures/spawt-qa.png')
        adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Pictures/spawt-qa.png')
        deep('place/'+PLACE); scroll_tap('place-contribute'); tap('contribution-gallery')
        try: tap('permission_allow_all_button',timeout=5)
        except AssertionError:
            try: tap('permission_allow_button',timeout=3)
            except AssertionError: pass
        pick_test_photo('contribution-menu'); find('contribution-remove-0',timeout=25)
        scroll_tap('contribution-comment'); adb('shell','input','text',('Recette menu natif '+RUN+' - image technique, pas un menu reel, ne pas publier.').replace(' ','%s')); back()
        restart(); deep('contribute/'+PLACE); scroll_find('contribution-remove-0')
        scroll_find('contribution-comment'); check('native menu draft survives process restart',('Recette menu natif '+RUN) in label(find('contribution-comment')))
        scroll_tap('contribution-send'); contribution_receipt(); snap('live-menu-contribution-received')
        end=time.monotonic()+180
        while time.monotonic()<end:
            deep('settings'); deep('contribute/'+PLACE); scroll_tap('contribution-refresh'); time.sleep(2)
            try: scroll_find('Menu technique '+RUN,attempts=5); break
            except AssertionError: time.sleep(3)
        else: raise AssertionError('Native private menu moderation was not received from panel')
        snap('live-menu-contribution-rejected'); check('native menu photo reached private staff review and reasoned rejection',True)
        if build>=42:
            # 0087 turns every approved location contribution into Guet evidence.
            # A simulated position must never be submitted for that approval.
            raise AssertionError('Full live receipt blocked: migration 0087 converts location approval into Guet evidence; a genuine admissible contribution is required to receive approval and the +5 Paws allocation')
        # Technical observation uses exactly the published position. The external
        # staff recipe preserves it; no invented field observation or visit is added.
        place=next(p for p in inventory if p['id']==PLACE)
        adb('emu','geo','fix',place['lng'],place['lat'])
        deep('place/'+PLACE); scroll_tap('place-contribute'); tap('contribution-kind-location'); tap('contribution-locate')
        try: tap('permission_allow_foreground_only_button',timeout=6)
        except AssertionError: pass
        find('contribution-position',timeout=35)
        scroll_tap('contribution-comment'); adb('shell','input','text',('Recette enrichissement natif '+RUN+' - GPS simule identique a la fiche, aucun releve terrain nouveau.').replace(' ','%s')); back()
        scroll_tap('contribution-send'); contribution_receipt(); snap('live-contribution-received')
        check('native location contribution receives a server receipt',True)
        end=time.monotonic()+180
        while time.monotonic()<end:
            deep('settings'); deep('contribute/'+PLACE)
            scroll_tap('contribution-refresh'); time.sleep(2)
            try: scroll_find('Validation native '+RUN,attempts=5); break
            except AssertionError: time.sleep(3)
        else: raise AssertionError('Native contribution approval and reward not received from panel')
        snap('live-contribution-reward'); find('5 Paws attribués'); find('contribution-team-reply')
        check('native contribution reads the staff decision and single Paws reward',True)
        deep('progression'); scroll_find('paws-balance',attempts=22)
        end=time.monotonic()+25
        while time.monotonic()<end and find('paws-balance').get('text')!=str(balance_before+5): time.sleep(1)
        check('native Paws balance increases exactly by the approved reward',find('paws-balance').get('text')==str(balance_before+5))
        scroll_find('Contribution validée'); snap('live-contribution-paws-ledger')
        deep('carte'); tap('carte-filter-mine'); find('0 lieux · 0 sur la carte')
        check('approved enrichment does not fabricate a personal spawt',True)
        enrichment={'nativeMenuPhotoReceivedAndModerated':True,'contributionReceiptReceived':True,'contributionModerationRead':True,'contributionRewardRead':True,'contributionDidNotCreateVisit':True,'pawsBalanceDelta':5,'contributionMarker':'Recette enrichissement natif '+RUN,'positionSimulatedForTechnicalTest':True}
    (OUT/'live-data.json').write_text(json.dumps({'build':build,'apiOrigin':cfg['EXPO_PUBLIC_SUPABASE_URL'],'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'nativeAuthenticated':True,'announcementsRead':True,'editorialTextMatched':True,'collectionRead':True,'fiveContentChecksPassed':True,'offlineFailureAndRecovery':True,'feedbackReceiptReceived':True,'feedbackReplyRead':True,'publicPlaceCount':len(inventory),'mappedPlaceCount':mapped,'personalExplorationChecked':True,'unratedDocumentaryRead':True,'feedbackMarker':MARKER,**enrichment},ensure_ascii=False,indent=2))

def pitch_preflight():
    """Fail closed before authentication: capture the published APK42 only."""
    import hashlib
    config=json.loads(pathlib.Path('documentation/android-qa.json').read_text())
    expected={'build':42,'previousBuild':41,'localBuildRun':41117097867,
              'sourceCommit':'8cf7ea89ef7610b69c28f7608218f4e005dbdc30',
              'buildWorkflowCommit':'360d181c9c15c6378b06ec41893afeb6a653f120'}
    check('pitch: original build42 provenance',all(config.get(k)==v for k,v in expected.items()))
    check('pitch: existing synthetic account',PHONE==config['phone'] and PHONE in ('+2250000000193','+2250000000194'))
    digest=hashlib.sha256()
    with pathlib.Path('spawt.apk').open('rb') as apk:
        for chunk in iter(lambda:apk.read(1024*1024),b''): digest.update(chunk)
    check('pitch: published APK42 SHA256',digest.hexdigest()=='2fba5164863e446c8a4087c48954e67a790073865c9cd94c31a3a9a9003160f7')
    package=adb('shell','dumpsys','package',PACKAGE)
    check('pitch: installed version42',bool(re.search(r'\bversionCode=42\b',package)) and 'versionName=1.1.1' in package)
    # This fresh emulator must not create simulated Guet events. No GPS fix,
    # background permission grant, app flag or server setting is changed.
    adb('shell','pm','revoke',PACKAGE,'android.permission.ACCESS_BACKGROUND_LOCATION')
    package=adb('shell','dumpsys','package',PACKAGE)
    check('pitch: background location not granted',not re.search(r'android\.permission\.ACCESS_BACKGROUND_LOCATION:\s*granted=true',package))
    # Remove emulator touch overlays, without altering the app or its images.
    for setting in ('show_touches','pointer_location'):
        adb('shell','settings','put','system',setting,'0')

def pitch_anonymous_cases():
    """Optional anonymous views before the unchanged synthetic login."""
    import hashlib
    entries=[]
    cases=[('00-onboarding','Ouverture · Rejoindre la bande',None,
            ['Plus jamais goumin de restaurant.','Rejoindre la bande']),
           ('00-phone','Connexion · Téléphone sans saisie','phone',['phone-input','phone-send'])]
    for key,title,path,anchors in cases:
        entry={'id':key,'label':title,'state':'manquant','requiresPrivacyReview':True,'privacyNotes':[]}
        entries.append(entry)
        try:
            if path: deep(path)
            for anchor in anchors: find(anchor,timeout=8)
            # Wait through the final reveal and recheck the same real controls.
            time.sleep(1)
            for anchor in anchors: find(anchor,timeout=2)
            name='pitch-'+key; snap(name)
            png=(OUT/(name+'.png')).read_bytes()
            entry.update(state='capturé',reason='Ancrages présents avant et après une pause de stabilité.',
                         file=name+'.png',xml=name+'.xml',sha256=hashlib.sha256(png).hexdigest(),
                         anchors=anchors,width=1179,height=2400)
        except AssertionError:
            entry.update(state='manquant',reason='Écran anonyme ou ancrage attendu absent ; collecte facultative.')
        except Exception:
            entry.update(state='erreur',reason='Échec technique facultatif de la capture anonyme.')
        finally:
            (OUT/'pitch-anonymous.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
            print('PITCH '+key+': '+entry['state'],flush=True)
    return entries

def pitch_cases():
    """Native product views, with no business submission or invented activity.

    Normal app telemetry remains enabled. Raw captures are internal material:
    review identifiers, QA labels and private history before public delivery.
    Missing optional surfaces are recorded, never replaced by a different page.
    """
    import hashlib, unicodedata
    fr=json.loads(pathlib.Path('app/src/i18n/fr.json').read_text())
    config=json.loads(pathlib.Path('documentation/android-qa.json').read_text())
    manifest={'mode':'pitch','build':42,'version':'1.1.1','runId':RUN,
              'sourceCommit':config['sourceCommit'],'buildRun':config['localBuildRun'],
              'apkSha256':'2fba5164863e446c8a4087c48954e67a790073865c9cd94c31a3a9a9003160f7',
              'nativeAuthenticated':True,'businessActionsSubmitted':False,
              'normalNavigationTelemetryMayBeWritten':True,
              'backgroundLocationGranted':False,'simulatedPositionInjected':False,
              'visibility':'internal-review-only','publicDeliveryRequiresPrivacyReview':True,
              'fullLiveReceipt':False,'consoleModerationReceipt':False,'physicalGuetReceipt':False,
              'publicReads':[],'captures':list(globals().get('PITCH_ANONYMOUS',[]))}
    seen={}
    class MissingView(Exception): pass
    class SessionLost(Exception): pass

    def save_manifest():
        manifest['updatedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
        manifest['counts']={state:sum(c['state']==state for c in manifest['captures'])
                            for state in ('capturé','manquant','erreur')}
        (OUT/'pitch-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))

    def translated(key):
        value=fr
        for part in key.split('.'):
            if not isinstance(value,dict) or part not in value: return key
            value=value[part]
        return value if isinstance(value,str) else key

    def present(tree,value):
        return any(value.casefold() in label(n).casefold() and len(bounds(n))==4
                   and bounds(n)[2]>bounds(n)[0] and 0<=bounds(n)[1]<bounds(n)[3]<=2400
                   for n in tree.iter('node'))

    def stable(required,timeout=24):
        previous=None; equal=0; deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            tree,raw=nodes()
            if present(tree,'phone-input') or present(tree,'otp-cell-0'):
                raise SessionLost('La session synthétique n’est plus authentifiée.')
            app_nodes=[n for n in tree.iter('node') if n.get('package')==PACKAGE]
            unavailable=[fr['rapide']['unavailable'],fr['carte']['unavailable_title'],
                         fr['carte']['module_unavailable'],fr['home']['collections_unavailable']]
            if any(present(tree,value) for value in unavailable):
                raise MissingView('La surface affiche son indisponibilité ; aucun flag activé pour la capture.')
            loading=any(n.get('class')=='android.widget.ProgressBar' for n in app_nodes)
            failed=present(tree,fr['common']['data_read_error'])
            signature=tuple(tuple(n.get(k,'') for k in
                            ('resource-id','text','content-desc','bounds','checked','selected')) for n in app_nodes)
            ready=bool(app_nodes) and all(present(tree,value) for value in required) and not loading and not failed
            equal=equal+1 if ready and signature==previous else 0
            if equal>=2: return tree,raw
            previous=signature if ready else None
            time.sleep(.8)
        raise MissingView('État stable ou ancrage attendu absent ; aucune image de remplacement.')

    def capture(key,title,prepare,required,privacy=()):
        entry={'id':key,'label':title,'state':'manquant','reason':'Vue non atteinte.',
               'requiresPrivacyReview':True,'privacyNotes':list(privacy)}
        manifest['captures'].append(entry); save_manifest()
        try:
            prepare(); time.sleep(1.5)
            tree,raw=stable(required)
            png=adb('exec-out','screencap','-p',binary=True)
            if not png.startswith(b'\x89PNG\r\n\x1a\n'): raise RuntimeError('Capture Android non PNG.')
            digest=hashlib.sha256(png).hexdigest()
            if digest in seen:
                raise MissingView('Image identique à '+seen[digest]+' ; doublon non livré.')
            name='pitch-'+key
            (OUT/(name+'.png')).write_bytes(png)
            (OUT/(name+'.xml')).write_text(raw)
            seen[digest]=key
            # Report only the presence of potentially private strings, not their values.
            visible=' '.join(n.get('text','')+' '+n.get('content-desc','') for n in tree.iter('node'))
            if re.search(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\+225\d{8,}',visible,re.I):
                entry['privacyNotes'].append('Identifiant ou numéro visible : revue requise avant diffusion.')
            entry.update(state='capturé',reason='Ancrages présents ; hiérarchie stable sur trois lectures.',
                         file=name+'.png',xml=name+'.xml',sha256=digest,anchors=list(required),
                         width=1179,height=2400)
        except SessionLost:
            entry.update(state='erreur',reason='Authentification perdue : arrêt bloquant du parcours.')
            raise
        except (MissingView,AssertionError) as exc:
            entry.update(state='manquant',reason=str(exc)[:220])
            # A missing route anchor must not disguise a lost login as an
            # optional screen. Authentication remains a blocking condition.
            try: current,_=nodes()
            except Exception: current=None
            if current is not None and (present(current,'phone-input') or present(current,'otp-cell-0')):
                entry.update(state='erreur',reason='Authentification perdue : arrêt bloquant du parcours.')
                raise SessionLost(entry['reason'])
        except Exception as exc:
            entry.update(state='erreur',reason='Échec technique de la vue : '+type(exc).__name__)
        finally:
            save_manifest()
            print('PITCH '+key+': '+entry['state'],flush=True)

    def omit(key,title,reason):
        manifest['captures'].append({'id':key,'label':title,'state':'manquant','reason':reason})
        save_manifest()

    def public_read(name,path):
        # Anon GET only; neither credentials nor full response bodies enter the manifest.
        try:
            cfg=json.loads(pathlib.Path('app/eas.json').read_text())['build']['preview']['env']
            request=urllib.request.Request(cfg['EXPO_PUBLIC_SUPABASE_URL']+'/rest/v1/'+path,
                       headers={'apikey':cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY']},method='GET')
            with urllib.request.urlopen(request,timeout=20) as response: rows=json.load(response)
            if not isinstance(rows,list): raise ValueError('Expected public list')
            manifest['publicReads'].append({'resource':name,'state':'lu','count':len(rows)})
            return rows
        except Exception as exc:
            manifest['publicReads'].append({'resource':name,'state':'erreur','reason':type(exc).__name__})
            return []

    def route(path,*anchors):
        deep(path)
        for anchor in anchors: find(anchor,timeout=12)

    def top():
        for _ in range(5):
            adb('shell','input','swipe','550','650','550','1850','220'); time.sleep(.2)

    def home_panel(mode):
        home(); tap('home-mode-'+mode,timeout=10); find('home-panel-'+mode,timeout=12)

    def search(query=''):
        # A modal from a previous optional capture may still be open.
        tree,_=nodes()
        if present(tree,fr['search']['filters_open']): back()
        deep('search')
        # Existing searches may retain their query, which hides the placeholder.
        # Wait for the actual field rather than assuming an empty form.
        deadline=time.monotonic()+12
        while time.monotonic()<deadline:
            tree,_=nodes()
            if present(tree,'phone-input') or present(tree,'otp-cell-0'):
                raise SessionLost('La session synthétique n’est plus authentifiée.')
            if any(n.get('package')==PACKAGE and n.get('class')=='android.widget.EditText' for n in tree.iter('node')): break
            time.sleep(.4)
        else: raise MissingView('Le champ de recherche natif est absent.')
        if any(n.get('content-desc')==fr['common']['clear'] for n in tree.iter('node')):
            tap(fr['common']['clear'],exact=True)
        if query:
            if not re.fullmatch(r'[A-Za-z0-9 ]+',query): raise MissingView('Terme de recherche non sûr pour ADB.')
            tree,_=nodes(); field=next(n for n in tree.iter('node') if n.get('class')=='android.widget.EditText')
            tap_node(field); adb('shell','input','text',query.replace(' ','%s'))
        # Hide only the keyboard, without backing out of the page.
        tree,_=nodes()
        keyboard=any('inputmethod' in n.get('package','') for n in tree.iter('node'))
        if keyboard or 'mInputShown=true' in adb('shell','dumpsys','input_method'): back()

    def map_view(filter_name,list_mode=False):
        route('carte','carte-inventory-count'); tap('carte-filter-'+filter_name)
        tree,_=nodes()
        if present(tree,fr['carte']['unavailable_title']): raise MissingView('Module carte indisponible dans l’APK ; aucun fallback présenté comme une carte.')
        toggle=find('carte-view-toggle',timeout=8)
        current_list=fr['carte']['show_map'].casefold() in label(toggle).casefold()
        # Text is sometimes exposed by the child rather than the Pressable.
        if not current_list: current_list=present(tree,fr['carte']['show_map'])
        if current_list!=list_mode: tap_node(toggle)
        time.sleep(3)

    def place_tab(place_id,tab):
        route('place/'+place_id,'place-start-review')
        scroll_tap(fr['place']['tab_'+tab]); time.sleep(1)

    def profile_start():
        home(); tap('Palais',exact=True); top(); find('spawtercard',timeout=15)

    def flip_card():
        card=bounds(find('spawtercard'))
        # Below the avatar, on the same live-bounds target as the received QA.
        adb('shell','input','tap',(card[0]+card[2])//2,card[3]-48); time.sleep(1)

    def community(filter_name):
        route('meute','community-feed')
        try: tap('community-filter-'+filter_name,timeout=3)
        except AssertionError:
            b=bounds(find('community-filters'))
            x1,x2=(b[2]-20,b[0]+20) if filter_name=='coup' else (b[0]+20,b[2]-20)
            adb('shell','input','swipe',x1,(b[1]+b[3])//2,x2,(b[1]+b[3])//2,300)
            tap('community-filter-'+filter_name,timeout=8)

    def contribution(kind):
        route('contribute/'+PLACE,'contribution-kind-menu'); tap('contribution-kind-'+kind)

    def content_checks():
        route('support','support-check'); tap('support-check'); find('support-check-sync',timeout=30)

    geometry(393,1)
    check('pitch: authenticated native home available',find('Accueil',timeout=15,exact=True) is not None)
    places=public_read('places','places?select=id,name&is_published=eq.true&limit=1000')
    menus=public_read('menus','public_menu_items?select=id,place_id,name&order=id&limit=20')
    editorials=public_read('editorials','public_editorial_reviews?select=place_id,body&limit=1')
    collections=public_read('collections','explore_collections?select=slug,title_key&is_published=eq.true&audience=eq.general&order=sort_order&limit=2')
    announcements=public_read('announcements','public_announcements?select=id,title&order=starts_at.desc&limit=2')
    save_manifest()

    capture('01-home','Accueil · Suggestions',lambda:home_panel('suggestions'),['home-panel-suggestions'])
    capture('02-home-personalized','Accueil · Pour ton Palais',lambda:scroll_find('home-personalized-feed',attempts=16),['home-personalized-feed'])
    for number,mode,title in [(3,'rapide','Rapide'),(4,'selections','Les sélections'),(5,'duo','En duo'),(6,'spots','Les spots')]:
        capture(f'{number:02d}-home-{mode}','Accueil · '+title,lambda m=mode:home_panel(m),['home-panel-'+mode])
    capture('07-rapide','Rapide · Choisir vite',lambda:route('rapide',fr['rapide']['subtitle']),[fr['rapide']['subtitle']])
    capture('08-search','Recherche · Découverte',search,[fr['search']['empty_cuisines_title']])
    capture('09-search-filters','Recherche · Filtres',lambda:(search(),tap('+ '+fr['search']['filters_button'],exact=True)),[fr['search']['filters_open'],fr['search']['filters_section_budget']])
    capture('10-search-place','Recherche · Adresse',lambda:search('Grande'),['La Grande République'])
    if menus:
        dish=menus[0]
        words=re.findall(r'[A-Za-z]{4,}',unicodedata.normalize('NFKD',dish['name']).encode('ascii','ignore').decode())
        if words:
            capture('11-search-dish','Recherche · Plat du menu publié',lambda:search(words[0]),[fr['outings']['dishes'],dish['name']])
        else: omit('11-search-dish','Recherche · Plat','Nom publié sans terme saisissable via ADB.')
    else: omit('11-search-dish','Recherche · Plat','Aucun plat publié reçu par la lecture publique.')
    capture('12-map','Carte · Tous les lieux',lambda:map_view('all'),['carte-inventory-count','carte-mapview'])
    capture('13-map-unexplored','Carte · À explorer',lambda:map_view('unexplored'),['carte-inventory-count','carte-mapview'])
    capture('14-map-list','Carte · Liste des lieux',lambda:map_view('all',True),['carte-inventory-count',fr['carte']['show_map']])
    capture('15-place','Fiche · La Grande République',lambda:route('place/'+PLACE,'La Grande République'),['La Grande République','place-start-review'])
    capture('16-place-media','Fiche · Médias',lambda:place_tab(PLACE,'media'),[fr['place']['tab_media'],fr['place']['tab_menu']])
    if menus and re.fullmatch(r'[0-9a-f-]{36}',menus[0]['place_id']):
        dish=menus[0]
        capture('17-place-menu','Fiche · Menu et plats publiés',lambda:(place_tab(dish['place_id'],'menu'),scroll_find(dish['name'],attempts=8)),[dish['name']])
    else: omit('17-place-menu','Fiche · Menu et plats','Aucun menu public exploitable reçu.')
    capture('18-place-reviews','Fiche · Avis des spawters',lambda:place_tab(PLACE,'reviews'),[fr['place']['tab_reviews']])
    capture('19-place-all-reviews','Fiche · Tous les avis',lambda:route('place/'+PLACE+'/reviews','Tous les avis'),['Tous les avis'])
    if editorials and re.fullmatch(r'[0-9a-f-]{36}',editorials[0]['place_id']) and editorials[0].get('body'):
        editorial=editorials[0]; excerpt=editorial['body'][:60]
        capture('20-place-editorial','Fiche · Avis éditorial publié',lambda:(route('place/'+editorial['place_id'],'place-start-review'),scroll_find(excerpt,attempts=22)),[excerpt])
    else: omit('20-place-editorial','Fiche · Avis éditorial','Aucun avis éditorial public reçu.')
    capture('21-collections','Carnets · Sélections publiées',lambda:route('explore','explore-collections'),['explore-collections'])
    for number,collection in enumerate(collections[:2],22):
        if not re.fullmatch(r'[A-Za-z0-9_-]+',collection['slug']): continue
        title=translated(collection['title_key'])
        capture(f'{number}-collection','Carnet · '+title,lambda c=collection,t=title:route('explore/'+c['slug'],t),[title])
    if not collections: omit('22-collection','Carnet · Détail','Aucun carnet public reçu ; aucun slug inventé.')
    capture('24-announcements','Le fil du Chat',lambda:route('actualites','announcements'),['announcements'])
    if announcements and re.fullmatch(r'[0-9a-f-]{36}',announcements[0]['id']):
        announcement=announcements[0]
        capture('25-announcement','Publication du Chat',lambda:route('actualites/'+announcement['id'],announcement['title']),[announcement['title']])
    else: omit('25-announcement','Publication du Chat','Aucune publication publique reçue.')
    for number,filter_name,title in [(26,'all','Tout'),(27,'review','Avis'),(28,'coup','Coups de cœur')]:
        capture(f'{number}-community-{filter_name}','La Bande · '+title,lambda f=filter_name:community(f),['community-feed','community-filter-'+filter_name],['Contenus publics ; vérifier les noms visibles avant le pitch.'])
    capture('29-profile-recto','Palais · Carte recto',profile_start,['spawtercard'],['Compte synthétique et identifiant de carte potentiellement visibles.'])
    capture('30-profile-verso','Palais · Carte verso',flip_card,['spawtercard',fr['axis']['racines'],fr['axis']['horizons']],['Compte synthétique ; axes soumis à la revue visuelle.'])
    capture('31-profile-archetype','Palais · Archétype et stade',lambda:(profile_start(),scroll_find(fr['profile']['archetype_section_title'],attempts=7)),[fr['profile']['archetype_section_title']])
    capture('32-profile-titles','Palais · Titres existants',lambda:(profile_start(),scroll_find(fr['profile']['collection_title'],attempts=7)),[fr['profile']['collection_title']])
    capture('33-profile-lists','Palais · Mes listes',lambda:(profile_start(),scroll_find(fr['profile']['link_settings'],attempts=9)),[fr['profile']['link_saved'],fr['profile']['link_settings']])
    capture('34-saved','Mes envies · État existant du compte',lambda:route('saved',fr['outings']['title']),[fr['outings']['title']],['Les listes de recette peuvent contenir des libellés QA.'])
    capture('35-coups-de-coeur','Mes Coups de Cœur · État existant',lambda:route('coups-de-coeur','Mes Coups de Cœur'),['Mes Coups de Cœur'])
    capture('36-settings-guet','Réglages · Le Guet',lambda:route('settings','settings-guet-switch'),['settings-guet-switch',fr['settings']['section_guet']])
    capture('37-support','Aide et retours',lambda:route('support','support-check'),['support-check',fr['support']['title']],['Ne pas diffuser un éventuel historique privé visible.'])
    capture('38-support-checks','Aide · Disponibilité réelle des contenus',content_checks,['support-check-sync','support-check-guet'])
    capture('39-contribution-menu','Compléter un lieu · Menu et prix',lambda:contribution('menu'),['contribution-kind-menu','contribution-gallery'],['Formulaire sans envoi ; vérifier qu’aucun historique privé n’est visible.'])
    capture('40-contribution-location','Compléter un lieu · Position',lambda:contribution('location'),['contribution-kind-location','contribution-locate'],['Aucune position relevée ni envoyée.'])
    capture('41-suggest-place','Suggérer un spot · Formulaire vide',lambda:route('suggest-place','suggest-name-input'),['suggest-name-input','suggest-landmark-input'])
    omit('42-review-form','Donner un avis','Non ouvert : le bouton Spawt crée une entrée avant la soumission ; aucun faux spawt autorisé.')
    omit('43-progression','Progression','Non ouvert : runBadgeCheck peut attribuer des badges au montage.')
    manifest['completed']=True; save_manifest()

try:
    # Garder le même format en dp, avec une surface 1x pour la vidéo : encoder
    # 2,8 millions de pixels concurrençait le lecteur sur l'émulateur logiciel.
    geometry(393,1,pixel_ratio=1)
    if MODE=='pitch': pitch_preflight()
    # Le launcher Google peut rester occupé après le premier redimensionnement.
    # L'app est lancée directement ; un éventuel ANR SPAWT reste un échec.
    adb('shell','am','force-stop','com.google.android.apps.nexuslauncher')
    # Ouverture à vitesse normale, puis animations système neutralisées pour la matrice.
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,1)
    # Laisser finir les services du premier boot ; l'app reste arrêtée.
    time.sleep(15)
    # Largeur paire imposée par l'encodeur ; l'écart d'un pixel est contrôlé
    # par le garde des proportions, avant toute analyse du mouvement.
    recording=subprocess.Popen(['adb','-s','emulator-5554','shell','screenrecord','--size','392x800','--time-limit','18','--bit-rate','1500000','/sdcard/opening.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
    recording.wait(timeout=25); adb('pull','/sdcard/opening.mp4',str(OUT/'opening.mp4'))
    # Décodeur et surfaces de cette ouverture anonyme, avant toute connexion.
    (OUT/'opening-logcat.txt').write_text(adb('logcat','-d','-v','threadtime'))
    # La matrice et les parcours tactiles gardent les captures 3x habituelles.
    geometry(393,1)
    tree,_=nodes()
    if any("Pixel Launcher isn't responding" in label(n) for n in tree.iter('node')):
        tap('Close app',exact=True)
    tree=snap('cold-opening')
    check('cold animated launch keeps SPAWT in foreground',any(n.get('package')==PACKAGE for n in tree.iter('node')))
    for key in ['window_animation_scale','transition_animation_scale','animator_duration_scale']:
        adb('shell','settings','put','global',key,0)
    if MODE=='opening':
        # Réception du vrai binaire distribué sans utiliser de compte ni envoyer
        # d'OTP. La reprise d'une session signée reste une autre réception.
        deep('phone'); find('phone-input'); find('phone-send')
        snap('anonymous-phone-first-process')
        check('anonymous phone controls available',True)
        before=adb('shell','pidof',PACKAGE).strip()
        check('first native process running',bool(before))
        adb('shell','am','force-stop',PACKAGE)
        adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        time.sleep(2)
        deep('phone'); find('phone-input',timeout=40); find('phone-send')
        after=adb('shell','pidof',PACKAGE).strip()
        check('new native process after force-stop',bool(after) and before!=after)
        snap('anonymous-phone-new-process')
        check('anonymous phone controls after process restart',True)
        raise SystemExit(0)  # finally conserve les assertions et l'état final.
    if MODE=='pitch': PITCH_ANONYMOUS=pitch_anonymous_cases()
    login(PHONE)
    snap('signed-in')
    if MODE=='pitch':
        pitch_cases()
        raise SystemExit(0)  # Capture-only branch must never fall through to mutation cases.
    if MODE=='raccordements':
        raccordements_cases()
        raise SystemExit(0)  # Separate candidate receipt; no live-data.json.
    if MODE=='live':
        # Receive the new journey first so its diagnostics do not require
        # repeating the already received editorial/moderation journey first.
        outing=None
        if json.loads(pathlib.Path('documentation/android-qa.json').read_text())['build']>=41:
            from android_outing_qa import run_outing_cases
            outing=run_outing_cases(globals())
        live_content_cases()
        if outing is not None:
            live=json.loads((OUT/'live-data.json').read_text())
            outing.update(feedbackReceipt=live['feedbackReceiptReceived'],sevenContentChecks=live['fiveContentChecksPassed'])
            (OUT/'outing-data.json').write_text(json.dumps(outing,ensure_ascii=False,indent=2))
        raise SystemExit(0)
    if MODE=='community':
        # Existing alpha account; this path never publishes, saves or changes backend data.
        for width in [320,360,393,430]:
            for scale in [1,1.3,1.5]:
                geometry(width,scale); deep('meute')
                find('community-filter-all'); snap(f'bande-{width}-{scale}-all')
                for value in ['coup','review','all','coup','all']:
                    try: tap('community-filter-'+value,timeout=3)
                    except AssertionError:
                        b=bounds(find('community-filters'))
                        x1,x2=(b[2]-20,b[0]+20) if value=='coup' else (b[0]+20,b[2]-20)
                        adb('shell','input','swipe',x1,(b[1]+b[3])//2,x2,(b[1]+b[3])//2,300)
                        tap('community-filter-'+value)
                    selected=bounds(find('community-filter-'+value))
                    check(f'{width}-{scale}: {value} touch height', selected[3]-selected[1]>=44*3-3)
                snap(f'bande-{width}-{scale}-selected')
        geometry(393,1); deep('meute'); find('community-filter-review'); tap('community-filter-review')
        time.sleep(2); tree=snap('bande-avis-publics')
        cards=[n for n in tree.iter('node') if n.get('resource-id','').startswith('community-place-')]
        check('public activity card visible',bool(cards))
        tap_node(cards[0]); snap('bande-place-opened'); back(); find('community-filter-review')
        check('place round trip returns to community',True)
        restart(); deep('meute'); find('community-filter-all'); snap('bande-after-restart')
        check('community restored after process restart',True)
        home(); find('home-mode-suggestions'); snap('home-suggestions-native')
        tap('home-mode-traine'); snap('home-se-poser-native'); tap('home-mode-suggestions')
    elif MODE=='observe':
        deep('place/'+PLACE); find('La Grande République'); snap('place-initial')
    elif MODE=='photos':
        photo_and_network_cases()
    else:
        deep('place/'+PLACE)
        try: tap('Sauvegarde pour plus tard',timeout=3)
        except AssertionError: pass  # Le favori peut déjà venir d'une recette précédente.
        for width in [320,360,393,430]:
            for scale in [1,1.3,1.5]:
                geometry(width,scale); home(); snap(f'{width}-{scale}-feed')
                scroll(); snap(f'{width}-{scale}-feed-cards')
                tap('Palais',exact=True); find('Recette Android'); snap(f'{width}-{scale}-profile')
                card=bounds(find('spawtercard',exact=True))
                check(f'{width}-{scale}: profile card stays inside horizontal padding',card[0]>=48 and card[2]<=width*3-48)
                deep('search'); find('Cherche un spawt')
                tree,_=nodes()
                field=next(n for n in tree.iter('node') if n.get('class')=='android.widget.EditText')
                tap_node(field); adb('shell','input','text','Grande'); back()
                find('La Grande République'); snap(f'{width}-{scale}-search')
                deep('saved'); find('La Grande République'); snap(f'{width}-{scale}-saved')
                deep('place/'+PLACE); find('La Grande République'); snap(f'{width}-{scale}-place')
                tap('place-start-review'); find('review-note_cuisine-5')
                snap(f'{width}-{scale}-review-title')
                scroll_tap('review-note_cuisine-5'); scroll_tap('review-note_cadre-4'); scroll_tap('review-note_service-4')
                scroll_find('review-global-rating')
                tree=snap(f'{width}-{scale}-review')
                check(f'{width}-{scale}: 4,3 visible',any('4,3' in label(n) for n in tree.iter('node')))
                button=find('review-submit'); b=bounds(button)
                check(f'{width}-{scale}: publish button within screen',b[1]>0 and b[3]<=2400)
                scroll_tap('review-text'); time.sleep(.7)
                snap(f'{width}-{scale}-keyboard')
                (OUT/f'{width}-{scale}-keyboard-window.txt').write_text(adb('shell','dumpsys','window','windows'))
                check(f'{width}-{scale}: keyboard footer remains on screen',bounds(find('review-submit'))[3]<2100)
                back()
                back()
        geometry(393,1); deep('place/'+PLACE); tap('place-start-review')
        scroll_tap('review-text'); adb('shell','input','text',MARKER.replace(' ','%s'))
        time.sleep(.7); tree=snap('keyboard-review'); button=find('review-submit')
        (OUT/'keyboard-input-method.txt').write_text(adb('shell','dumpsys','input_method'))
        (OUT/'keyboard-window.txt').write_text(adb('shell','dumpsys','window','windows'))
        b=list(map(int,re.findall(r'\d+',button.get('bounds','')))); check('keyboard publish remains above IME',b[3]<2100)
        back(); tap('review-submit'); find('Avis publié',timeout=40); snap('published-receipt'); tap('OK',exact=True)
        # Redémarrage réel du processus, sans effacer le stockage.
        restart(); deep('place/'+PLACE)
        scroll_tap('Avis')
        # La fiche montre les cinq avis les mieux notés. Un nouvel avis à 4,3
        # peut être au-delà de ce résumé : suivre le vrai parcours de lecture.
        try:
            scroll_tap('Voir tous les avis')
        except AssertionError:
            deep('place/'+PLACE); scroll_tap('Avis')
        scroll_find(MARKER); snap('published-after-restart')
        check('review visible after process restart',True)
        rows=[r for r in public_reviews() if r['texte_avis']==MARKER]
        check('one native review persisted with 5/4/4 and 4.3',len(rows)==1 and rows[0]['note_cuisine']==5 and rows[0]['note_cadre']==4 and rows[0]['note_service']==4 and rows[0]['note_globale']==4.3)
        if MODE=='full': photo_and_network_cases()
finally:
    try: adb('shell','cmd','connectivity','airplane-mode','disable')
    except Exception: pass
    (OUT/'assertions.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2))
    try: snap('last-state')
    except Exception: pass
