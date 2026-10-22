"""Live outings receipt for the signed APK; only whitelisted synthetic accounts.
All mutations under test originate from native controls. The extra user session
only observes their server receipts and removes the recipe's private list.
"""
import json, pathlib, time, urllib.request, urllib.error, xml.etree.ElementTree as ET, uuid, os


def run_outing_cases(g):
    cfg=json.loads(pathlib.Path('app/eas.json').read_text())['build']['preview']['env']
    origin=cfg['EXPO_PUBLIC_SUPABASE_URL'];anon=cfg['EXPO_PUBLIC_SUPABASE_ANON_KEY']
    assert origin=='https://api.spawt.online' and g['PHONE'] in ('+2250000000193','+2250000000194')
    def req(path,body=None,token=None,method=None):
        r=urllib.request.Request(origin+path,data=None if body is None else json.dumps(body).encode(),method=method,headers={'apikey':anon,'Authorization':'Bearer '+(token or anon),'Content-Type':'application/json'})
        with urllib.request.urlopen(r,timeout=30) as response:
            raw=response.read();return json.loads(raw) if raw else None
    def auth(phone):
        assert phone in ('+2250000000193','+2250000000194')
        payload={'phone_e164':phone,'otp_code':'123456'}
        try:s=req('/functions/v1/otp-verify',payload)
        except urllib.error.HTTPError as error:
            # The secondary account did not go through the native OTP screen.
            # Follow the same send/verify protocol instead of assuming an old
            # pending code still exists. These are synthetic test numbers only.
            if error.code!=400 or json.loads(error.read()).get('error')!='no_pending_otp':raise
            sent=req('/functions/v1/otp-send',{'phone_e164':phone})
            assert sent['success'] and sent['request_id'].startswith(('mock-','reviewer-'))
            s=req('/functions/v1/otp-verify',payload)
        assert s['success'];return s
    s=auth(g['PHONE']);assert s['user_id']==g['OWNER'];token=s['access_token']
    def state():return req('/rest/v1/rpc/my_outings',{'p_owner':g['OWNER']},token)
    def until(fn,seconds=45):
        end=time.monotonic()+seconds
        while time.monotonic()<end:
            value=fn()
            if value:return value
            time.sleep(2)
        raise AssertionError('Expected server receipt did not arrive')
    adb=g['adb'];deep=g['deep'];tap=g['tap'];find=g['find'];snap=g['snap'];check=g['check'];back=g['back'];scroll_tap=g['scroll_tap'];scroll_find=g['scroll_find'];restart=g['restart']
    def stable_action(value):
        # Loading notices move the list toolbar. Require the enabled action
        # to retain its actual native bounds across two settled UI dumps.
        end=time.monotonic()+45;previous=None
        while time.monotonic()<end:
            tree,_=g['nodes']()
            texts=[g['label'](n).casefold() for n in tree.iter('node')]
            if any('un instant' in t or 'synchronisation en attente' in t for t in texts):
                previous=None;time.sleep(.5);continue
            found=next((n for n in tree.iter('node') if n.get('clickable')=='true' and n.get('enabled')=='true' and any(n.get(k,'')==value for k in ('text','content-desc'))),None)
            if found is not None:
                position=g['bounds'](found)
                if position[1]>=72 and position[3]<=2320 and position[2]>position[0] and position[3]>position[1]:
                    if position==previous:g['tap_node'](found);return found
                    previous=position
                else:previous=None
            else:previous=None
            time.sleep(.5)
        raise AssertionError('Native action not settled, visible and enabled: '+value)
    out=g['OUT'];run=g['RUN'];place='c5acfd12-01dd-5cd3-9beb-0531d89c3e99'
    dishes=req('/rest/v1/public_menu_items?select=*&place_id=eq.'+place)
    dish=next(d for d in dishes if d['name']=='Eggs Benedict')
    check('published real dish has source date and observed price',dish['price_xof']==7000 and bool(dish['source_url']) and bool(dish['observed_on']))
    deep('place/'+place+'?tab=menu');scroll_find(dish['name'],attempts=25);snap('outing-native-menu');check('native place reads published structured menu',True)
    deep('search');tree,_=g['nodes']();field=next(n for n in tree.iter('node') if n.get('class')=='android.widget.EditText')
    g['tap_node'](field);adb('shell','input','text','oeufs');back();find(dish['name']);snap('outing-dish-search');check('native alias search reaches published dish',True)
    # Offline save is acknowledged locally, then actually received after restart.
    assert not any(d['id']==dish['id'] for d in state()['dishes']), 'Clean only the synthetic recipe account before retrying'
    adb('shell','cmd','connectivity','airplane-mode','enable');adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
    tap('save-intent-'+dish['id']);deep('saved');scroll_find(dish['name']);find('Synchronisation en attente');snap('outing-offline-save')
    restart();deep('saved');scroll_find(dish['name']);snap('outing-offline-restart')
    adb('shell','cmd','connectivity','airplane-mode','disable');adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');time.sleep(4)
    restart();deep('saved');until(lambda:any(d['id']==dish['id'] for d in state()['dishes']));check('offline dish save persists and reaches owning server account',True)
    title='Brunch recette '+run
    deep('saved?addDish='+dish['id']);tap('Créer une liste');tap('Le nom de ta liste');adb('shell','input','text',title.replace(' ','%s'));back();tap('Brunch',exact=True);tap('Enregistrer',exact=True)
    entry=until(lambda:next((l for l in state()['lists'] if l['title']==title),None));lid=entry['id']
    until(lambda:any(i['list_id']==lid and i['menu_item_id']==dish['id'] for i in state()['items']))
    snap('outing-named-list');check('native named occasion list and dish received by server',True)
    deep('saved?addPlace='+place);tap(title,exact=True);until(lambda:any(i['list_id']==lid and i['place_id']==place for i in state()['items']))
    previous_choice=next((c['chosen_at'] for c in state()['choices'] if c['place_id']==place),None)
    scroll_tap('Choisir ce lieu');find('Cette envie est choisie');tap('OK',exact=True);until(lambda:any(c['place_id']==place and c['chosen_at']!=previous_choice for c in state()['choices']));check('native explicit choice receives a new server receipt without visit',True)
    # Reopen at the top after choosing below the fold. An existing route may
    # retain its scroll offset and expose a clipped accessibility target.
    restart();deep('saved');stable_action(title)
    snap('outing-before-share');stable_action('Partager')
    check('share action is settled, visible and enabled',True)
    # Wait for the real server receipt before dismissing the Android chooser.
    # On failure, keep the current native error/sheet visible for diagnosis.
    entry=until(lambda:next((l for l in state()['lists'] if l['id']==lid and l['share_token']),None));url='https://spawt.online/liste/'+entry['share_token']
    snap('outing-share-result');back()
    from playwright.sync_api import sync_playwright,expect
    with sync_playwright() as pw:
        b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':393,'height':852})
        response=p.goto(url,wait_until='networkidle');assert response.status==200;expect(p.get_by_role('heading',name=title)).to_be_visible();expect(p.get_by_text(dish['name'],exact=True)).to_be_visible()
        p.screenshot(path=str(out/'outing-public-browser.png'),full_page=True);check('native shared list is readable in anonymous real browser',True)
        # Android must resolve the public HTTPS link to this installed signed app.
        adb('shell','pm','verify-app-links','--re-verify',g['PACKAGE'])
        end=time.monotonic()+60
        while True:
            links=adb('shell','pm','get-app-links',g['PACKAGE'])
            if 'spawt.online: verified' in links or time.monotonic()>=end:break
            time.sleep(2)
        (out/'outing-app-links.txt').write_text(links)
        check('Android verifies official website App Link', 'spawt.online: verified' in links)
        deep('settings')  # Start elsewhere: a stale saved-list title cannot satisfy this check.
        result=adb('shell','am','start','-W','-a','android.intent.action.VIEW','-c','android.intent.category.BROWSABLE','-d',url)
        (out/'outing-link-navigation.txt').write_text(result);find(title);tree=snap('outing-app-link')
        check('public HTTPS list opens the installed native package',any(n.get('package')==g['PACKAGE'] for n in tree.iter('node')))
        restart();deep('saved');stable_action(title);snap('outing-before-revoke');stable_action('Désactiver le lien')
        until(lambda:next((l for l in state()['lists'] if l['id']==lid and l['share_token'] is None),None));snap('outing-revoke-received')
        response=p.goto(url,wait_until='networkidle');assert response.status==404;expect(p.get_by_text('Ce lien n’est plus disponible.')).to_be_visible();p.screenshot(path=str(out/'outing-revoked-browser.png'),full_page=True);b.close()
    check('native revoke immediately removes public browser access',True)
    # Account B cannot read or mutate account A's private list.
    other=auth('+2250000000194' if g['PHONE'].endswith('193') else '+2250000000193')
    try:
        own=req('/rest/v1/rpc/my_outings',{'p_owner':other['user_id']},other['access_token']);check('other account does not receive private list',not any(l['id']==lid for l in own['lists']))
        leaked=req('/rest/v1/rpc/my_outings',{'p_owner':g['OWNER']},other['access_token']);check('cross-owner snapshot rejected',leaked is None)
    finally:req('/auth/v1/logout?scope=local',token=other['access_token'],method='POST')
    metadata=json.loads((out/'apk-metadata.json').read_text())
    upgrade=json.loads((out/'upgrade-install.json').read_text())
    proof={'upgradeInstall':upgrade,'build':metadata['build'],'sha256':metadata['sha256'],'apiOrigin':origin,'menuRead':True,'dishSearch':True,'saveReceipt':True,'namedListRead':True,'shareReadInBrowser':True,'revokedLinkRefused':True,'chooseReceipt':True,'appLinkOpened':True,'guetEnabled':False,'physicalGuetReceipt':False,'offlineSaveResumed':True,'crossAccountIsolation':True,'placeId':place,'menuItemId':dish['id'],'listId':lid,'listTitle':title,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    flags=req('/rest/v1/feature_flags?select=enabled&flag_code=eq.guet-proximity-v2',token=token)
    assert flags and not any(f['enabled'] for f in flags)
    # Private QA artifacts are not public catalogue data or commercial activity.
    for action,payload in [('list_delete',{'list_id':lid}),('unsave',{'menu_item_id':dish['id']}),('unsave',{'place_id':place})]:
        req('/rest/v1/rpc/mutate_outing',{'p_id':str(uuid.uuid4()),'p_action':action,'p_payload':payload,'p_owner':g['OWNER']},token)
    req('/auth/v1/logout?scope=local',token=token,method='POST')
    return proof  # Caller adds real live-content receipts only after they pass.
