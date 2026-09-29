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
  new Thread(()->{try{download(url,apk);getActivity().runOnUiThread(()->openInstaller(context,apk));call.resolve();}catch(Exception e){call.reject("Falha ao baixar a atualização: "+e.getMessage());}},"morok-updater").start();
 }
 @PluginMethod public void startVoiceService(PluginCall call){
  Context c=getContext(); Intent i=new Intent(c,MorokVoiceService.class);
  if(Build.VERSION.SDK_INT>=26)c.startForegroundService(i);else c.startService(i);
  call.resolve();
 }
 @PluginMethod public void stopVoiceService(PluginCall call){getContext().stopService(new Intent(getContext(),MorokVoiceService.class));call.resolve();}
 @PluginMethod public void requestOverlay(PluginCall call){
  if(Build.VERSION.SDK_INT>=23&&!Settings.canDrawOverlays(getContext())){
   Intent i=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getContext().getPackageName()));i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);getContext().startActivity(i);
  }
  call.resolve();
 }
 private void download(String source,File destination)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(source).openConnection();c.setInstanceFollowRedirects(true);c.setConnectTimeout(20000);c.setReadTimeout(120000);c.setRequestProperty("User-Agent","Morok-Updater/1.0");c.connect();
  int code=c.getResponseCode();if(code<200||code>=300)throw new Exception("HTTP "+code);
  File partial=new File(destination.getAbsolutePath()+".part");
  try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(partial)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}finally{c.disconnect();}
  if(destination.exists()&&!destination.delete())throw new Exception("Não foi possível substituir o APK temporário.");
  if(!partial.renameTo(destination))throw new Exception("Não foi possível finalizar o APK.");
 }
 private void openInstaller(Context context,File apk){
  try{
   if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O&&!context.getPackageManager().canRequestPackageInstalls()){Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+context.getPackageName()));settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(settings);return;}
   Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",apk);Intent intent=new Intent(Intent.ACTION_INSTALL_PACKAGE);intent.setDataAndType(uri,"application/vnd.android.package-archive");intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(intent);
  }catch(Exception e){try{Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",apk);Intent intent=new Intent(Intent.ACTION_VIEW);intent.setDataAndType(uri,"application/vnd.android.package-archive");intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(intent);}catch(Exception ignored){}}
 }
}
EOF

cat > "$JAVA/MorokVoiceService.java" <<'EOF'
package com.korczak.morok;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.*;
import android.provider.Settings;
import android.speech.*;
import android.view.*;
import android.widget.*;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import java.util.*;

public class MorokVoiceService extends Service {
 private static final String CHANNEL="morok_voice";
 private SpeechRecognizer recognizer;
 private Handler handler=new Handler(Looper.getMainLooper());
 private boolean commandMode=false, listening=false;
 private TextView overlayText;
 private WindowManager windowManager;

 @Override public void onCreate(){super.onCreate();createChannel();startForeground(4201,notification());handler.post(this::startListening);}
 private Notification notification(){return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("Morok").setContentText("Comando de voz ativo").setOngoing(true).build();}
 private void createChannel(){if(Build.VERSION.SDK_INT>=26)((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel(CHANNEL,"Morok — Voz",NotificationManager.IMPORTANCE_LOW));}

 private void startListening(){
  if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){showOverlay("MICROFONE NECESSÁRIO");return;}
  if(!SpeechRecognizer.isRecognitionAvailable(this)){showOverlay("RECONHECIMENTO DE VOZ INDISPONÍVEL");return;}
  if(recognizer!=null)try{recognizer.destroy();}catch(Exception ignored){}
  recognizer=SpeechRecognizer.createSpeechRecognizer(this);
  recognizer.setRecognitionListener(new RecognitionListener(){
   public void onReadyForSpeech(Bundle b){listening=true;}
   public void onBeginningOfSpeech(){ }
   public void onRmsChanged(float r){ }
   public void onBufferReceived(byte[] b){}
   public void onEndOfSpeech(){listening=false;restart(250);}
   public void onError(int e){listening=false;restart(e==SpeechRecognizer.ERROR_NETWORK?1200:300);}
   public void onResults(Bundle b){handleResults(b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION));restart(350);}
   public void onPartialResults(Bundle b){handlePartial(b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION));}
   public void onEvent(int a,Bundle b){}
  });
  Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
  i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
  i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"pt-BR");
  i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
  i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,5);
  recognizer.startListening(i);
 }
 private void restart(long ms){handler.postDelayed(()->{if(!listening)startListening();},ms);}
 private String norm(String s){return s==null?"":java.text.Normalizer.normalize(s,java.text.Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).trim();}
 private boolean wake(String s){String n=norm(s);return n.matches(".*\\b(hey\\s+morok|ok\\s+morok|okay\\s+morok|morok)\\b.*");}
 private String stripWake(String s){String n=norm(s);return n.replaceFirst(".*?\\b(?:hey\\s+morok|ok\\s+morok|okay\\s+morok|morok)\\b\\s*","").trim();}
 private void handlePartial(ArrayList<String> list){if(list==null)return;String s=list.isEmpty()?"":list.get(0);if(!commandMode&&wake(s)){commandMode=true;showOverlay("MOROK ATIVO — DIGA O COMANDO");}}
 private void handleResults(ArrayList<String> list){
  if(list==null||list.isEmpty())return;String s=list.get(0);
  if(!commandMode){if(wake(s)){commandMode=true;showOverlay("MOROK ATIVO — DIGA O COMANDO");}return;}
  String command=stripWake(s);commandMode=false;executeCommand(command);
 }
 private void executeCommand(String raw){
  String c=norm(raw); if(c.isEmpty()){showOverlay("NÃO ENTENDI");return;}
  if(c.matches(".*(hora|horas).*")){showOverlay("AGORA SÃO "+new java.text.SimpleDateFormat("HH:mm:ss",Locale.getDefault()).format(new Date()));return;}
  if(c.matches(".*(data|dia de hoje|hoje).*")){showOverlay(new java.text.SimpleDateFormat("dd/MM/yyyy",Locale.getDefault()).format(new Date()));return;}
  if(c.matches(".*(atualiza|atualizacao|versao|versao nova).*")){showOverlay("VERIFICANDO ATUALIZAÇÃO");broadcast("update");return;}
  if(c.matches(".*(abrir|mostrar).*morok.*")){showOverlay("MOROK ATIVO");broadcast("open");return;}
  if(c.matches(".*(fechar|ocultar).*")){hideOverlay();return;}
  if(c.matches(".*(projeto|projetos).*")){showOverlay("PROJETOS");broadcast("projects");return;}
  if(c.matches(".*(seguranca).*")){showOverlay("SEGURANÇA");broadcast("security");return;}
  if(c.matches(".*(rede|conexao).*")){showOverlay("REDE");broadcast("network");return;}
  showOverlay("COMANDO NÃO RECONHECIDO");
 }
 private void broadcast(String command){Intent i=new Intent("com.korczak.morok.VOICE_COMMAND");i.setPackage(getPackageName());i.putExtra("command",command);sendBroadcast(i);}
 private void showOverlay(String text){
  if(Build.VERSION.SDK_INT>=23&&!Settings.canDrawOverlays(this))return;
  handler.post(()->{
   if(windowManager==null)windowManager=(WindowManager)getSystemService(WINDOW_SERVICE);
   if(overlayText==null){
    overlayText=new TextView(this);overlayText.setTextColor(Color.WHITE);overlayText.setTextSize(14);overlayText.setGravity(Gravity.CENTER);overlayText.setPadding(32,18,32,18);overlayText.setBackgroundColor(Color.argb(225,8,7,18));
    WindowManager.LayoutParams p=new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.WRAP_CONTENT,Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,PixelFormat.TRANSLUCENT);p.gravity=Gravity.TOP|Gravity.CENTER_HORIZONTAL;p.y=90;windowManager.addView(overlayText,p);
   }
   overlayText.setText(text);overlayText.setVisibility(View.VISIBLE);handler.removeCallbacks(hideTask);handler.postDelayed(hideTask,3500);
  });
 }
 private final Runnable hideTask=()->{if(overlayText!=null)overlayText.setVisibility(View.GONE);};
 private void hideOverlay(){handler.post(hideTask);}
 @Override public int onStartCommand(Intent i,int f,int id){return START_STICKY;}
 @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);if(recognizer!=null)recognizer.destroy();if(overlayText!=null&&windowManager!=null)windowManager.removeView(overlayText);super.onDestroy();}
 @Override public android.os.IBinder onBind(Intent i){return null;}
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
