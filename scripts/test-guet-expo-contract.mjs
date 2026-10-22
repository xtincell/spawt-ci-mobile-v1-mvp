// Execute the installed SDK parser, not a mock of its validation rules.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../app/package.json',import.meta.url));
const ts = require('typescript');
const platform = { OS:'android',select: x => x.android ?? x.default };
const calls = [];
const native = { scheduleNotificationAsync: async (...args) => { calls.push(args); return args[0]; } };
function load(file, imports) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText;
 vm.runInNewContext(code,{ exports,require: name => { if (!(name in imports)) throw new Error('Unexpected import: '+name); return imports[name]; },URL,console,__DEV__:false,Date });
 return exports;
}
const sdkRoot = new URL('../app/node_modules/expo-notifications/src/',import.meta.url);
const enums = load(new URL('Notifications.types.ts',sdkRoot),{'expo-modules-core':{}});
const validator = load(new URL('hasValidTriggerObject.ts',sdkRoot),{});
const sdk = load(new URL('scheduleNotificationAsync.ts',sdkRoot),{
 'expo-modules-core':{ Platform:platform,UnavailabilityError:Error,uuid:{v4:()=> 'id'} },
 './NotificationScheduler':{default:native},'./Notifications.types':enums,'./hasValidTriggerObject':validator,
});
await assert.rejects(sdk.scheduleNotificationAsync({content:{title:'old'},trigger:{seconds:120}}),/trigger|type/i);
const app = load(new URL('../app/src/lib/guet/guet-notifications.ts',import.meta.url),{
 'react-native':{Platform:platform},
 'expo-notifications':{...enums,AndroidImportance:{DEFAULT:3},scheduleNotificationAsync:sdk.scheduleNotificationAsync,setNotificationChannelAsync:async()=>{},setNotificationCategoryAsync:async()=>{},cancelScheduledNotificationAsync:async()=>{}},
 '../../i18n/fr.json':{default:JSON.parse(fs.readFileSync(new URL('../app/src/i18n/fr.json',import.meta.url),'utf8'))},
});
const result = await app.scheduleGuetPrompt({row_id:'r',owner_id:'a',place_id:'p',place_name:'Lieu'},120);
assert.equal(result,'spawt:guet:v2:r');
assert.equal(calls.length,1);
assert.equal(calls[0][2].type,'timeInterval');
assert.equal(calls[0][2].seconds,120);
assert.equal(calls[0][2].channelId,'guet');
assert.equal(calls[0][2].repeats,false);
console.log('PASS installed Expo SDK: old trigger rejected, Guet trigger forwarded to native scheduler');
