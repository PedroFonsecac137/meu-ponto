import sharp from 'sharp';
import {writeFileSync} from 'node:fs';
const source='public/logo.svg';
await sharp(source).resize(512,512).png().toFile('public/logo.png');
for(const [density,size] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){
 for(const name of ['ic_launcher','ic_launcher_round'])await sharp(source).resize(size,size).png().toFile(`android/app/src/main/res/mipmap-${density}/${name}.png`);
}
const vector=`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><group android:scaleX="0.72" android:scaleY="0.72" android:translateX="15.12" android:translateY="15.12"><path android:fillColor="@android:color/transparent" android:strokeColor="#f5f8ed" android:strokeWidth="6" android:pathData="M54,24a30,30 0,1 0,0 60a30,30 0,1 0,0 -60"/><path android:fillColor="@android:color/transparent" android:strokeColor="#f5f8ed" android:strokeWidth="6" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="M54,35v20l13,8"/><path android:fillColor="#c8ee91" android:pathData="M78,18a12,12 0,1 0,0 24a12,12 0,1 0,0 -24"/><path android:fillColor="@android:color/transparent" android:strokeColor="#154e43" android:strokeWidth="3" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="M73,30l3,3l6,-7"/></group></vector>`;
writeFileSync('android/app/src/main/res/drawable/ic_launcher_foreground.xml',vector);
writeFileSync('android/app/src/main/res/values/ic_launcher_background.xml','<resources><color name="ic_launcher_background">#154e43</color></resources>');
for(const name of ['ic_launcher','ic_launcher_round'])writeFileSync(`android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`,'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/></adaptive-icon>');
