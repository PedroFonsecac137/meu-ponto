import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const cap=(...args)=>execFileSync(process.execPath,['node_modules/@capacitor/cli/bin/capacitor',...args],{stdio:'inherit'});
if(!existsSync('android'))cap('add','android');
cap('sync','android');
// Distinct app icon, generated as an Android vector drawable.
writeFileSync('android/app/src/main/res/drawable/ic_launcher_foreground.xml',`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#28694f" android:pathData="M0,0h108v108h-108z"/><path android:fillColor="@android:color/transparent" android:strokeColor="#ffffff" android:strokeWidth="5" android:pathData="M54,28a26,26 0,1 0,0 52a26,26 0,1 0,0 -52"/><path android:fillColor="@android:color/transparent" android:strokeColor="#ffffff" android:strokeWidth="5" android:strokeLineCap="round" android:pathData="M54,37v18l13,8"/></vector>`);
const gradle='android/app/build.gradle';
const run=Number(process.env.GITHUB_RUN_NUMBER||1);
writeFileSync(gradle,readFileSync(gradle,'utf8').replace(/versionCode \d+/,`versionCode ${run}`));
