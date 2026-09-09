import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
export async function readRecords(key:string){
  if(Capacitor.isNativePlatform())return (await Preferences.get({key})).value;
  return localStorage.getItem(key);
}
export async function writeRecords(key:string,value:string){
  if(Capacitor.isNativePlatform())await Preferences.set({key,value});
  else localStorage.setItem(key,value);
}
export async function exportCsv(csv:string,name:string){
  if(Capacitor.isNativePlatform()){
    const file=await Filesystem.writeFile({path:name,data:csv,directory:Directory.Cache,encoding:Encoding.UTF8});
    await Share.share({title:'Folha de ponto',files:[file.uri],dialogTitle:'Salvar ou compartilhar sua folha de ponto'});
    return;
  }
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
