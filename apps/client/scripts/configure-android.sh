#!/usr/bin/env bash
set -euo pipefail
APP=apps/client/android
JAVA=$APP/app/src/main/java/com/korczak/morok
RES=$APP/app/src/main/res
mkdir -p "$JAVA" "$RES/xml"

cat > "$JAVA/MainActivity.java" <<'EOF'
package com.korczak.morok;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle b){ registerPlugin(MorokUpdaterPlugin.class); super.onCreate(b); }
}
EOF

cat > "$JAVA/MorokUpdaterPlugin.java" <<'EOF'
package com.korczak.morok;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;

@CapacitorPlugin(name="MorokUpdater")
public class MorokUpdaterPlugin extends Plugin {
 @PluginMethod
 public void installApk(PluginCall call){
  String url=call.getString("url","");
  if(url.isEmpty() || !(url.startsWith("https://github.com/") || url.startsWith("https://objects.githubusercontent.com/"))){ call.reject("Fonte de atualização não permitida."); return; }
  Context context=getContext();
  File dir=new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),"updates");
  if(!dir.exists()&&!dir.mkdirs()){call.reject("Não foi possível criar a pasta de atualização.");return;}
  File apk=new File(dir,"morok-update.apk");
  new Thread(()->{
   try{
    download(url,apk);
    getActivity().runOnUiThread(()->openInstaller(context,apk));
    call.resolve();
   }catch(Exception e){call.reject("Falha ao baixar a atualização: "+e.getMessage());}
  },"morok-updater").start();
 }
 private void download(String source,File destination)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(source).openConnection();
  c.setInstanceFollowRedirects(true); c.setConnectTimeout(20000); c.setReadTimeout(120000);
  c.setRequestProperty("User-Agent","Morok-Updater/1.0"); c.connect();
  int code=c.getResponseCode();
  if(code<200||code>=300)throw new Exception("HTTP "+code);
  File partial=new File(destination.getAbsolutePath()+".part");
  try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(partial)){
   byte[] buffer=new byte[65536]; int read;
   while((read=in.read(buffer))!=-1)out.write(buffer,0,read);
  }finally{c.disconnect();}
  if(destination.exists()&&!destination.delete())throw new Exception("Não foi possível substituir o APK temporário.");
  if(!partial.renameTo(destination))throw new Exception("Não foi possível finalizar o APK.");
 }
 private void openInstaller(Context context,File apk){
  try{
   if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O&&!context.getPackageManager().canRequestPackageInstalls()){
    Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+context.getPackageName()));
    settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(settings); return;
   }
   Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",apk);
   Intent intent=new Intent(Intent.ACTION_INSTALL_PACKAGE);
   intent.setDataAndType(uri,"application/vnd.android.package-archive");
   intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
   context.startActivity(intent);
  }catch(Exception e){ callInstallerFallback(context,apk); }
 }
 private void callInstallerFallback(Context context,File apk){
  try{
   Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",apk);
   Intent intent=new Intent(Intent.ACTION_VIEW);
   intent.setDataAndType(uri,"application/vnd.android.package-archive");
   intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
   context.startActivity(intent);
  }catch(Exception ignored){}
 }
}
EOF
cat > "$RES/xml/file_paths.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?><paths xmlns:android="http://schemas.android.com/apk/res/android"><external-files-path name="updates" path="Download/updates/" /></paths>
EOF
python3 - <<'PY'
from pathlib import Path
p=Path("apps/client/android/app/src/main/AndroidManifest.xml")
s=p.read_text()
permission='<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'
if permission not in s:
 i=s.find(">",s.find("<manifest"))
 s=s[:i+1]+"\n    "+permission+s[i+1:]
provider='''        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="com.korczak.morok.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>'''
if "androidx.core.content.FileProvider" not in s:
 s=s.replace("</application>",provider+"\n    </application>",1)
p.write_text(s)
PY
