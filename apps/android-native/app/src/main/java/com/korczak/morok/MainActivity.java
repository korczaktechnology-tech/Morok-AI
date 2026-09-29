package com.korczak.morok;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.speech.*;
import android.view.*;
import android.widget.*;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.util.*;

public class MainActivity extends Activity {
    private static final String VERSION = "0.1.5";
    private static final String RELEASES = "https://api.github.com/repos/korczaktechnology-tech/Morok-AI/releases?per_page=20";
    private TextView clock, status;
    private SpeechRecognizer recognizer;
    private boolean checking = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(3,3,10));
        getWindow().setNavigationBarColor(Color.rgb(3,3,10));
        setContentView(new MorokView(this));
        requestMic();
        new Handler(Looper.getMainLooper()).postDelayed(this::checkForUpdate, 900);
    }

    private void requestMic() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 91);
    }

    private void checkForUpdate() {
        if (checking) return;
        checking = true;
        status.setText("VERIFICANDO GITHUB...");
        new Thread(() -> {
            try {
                HttpURLConnection c=(HttpURLConnection)new URL(RELEASES).openConnection();
                c.setRequestProperty("Accept","application/vnd.github+json");
                c.setRequestProperty("User-Agent","Morok-Android/"+VERSION);
                c.setConnectTimeout(10000); c.setReadTimeout(20000);
                int code=c.getResponseCode();
                if(code<200||code>=300) throw new IOException("HTTP "+code);
                String json=read(c.getInputStream()); c.disconnect();
                JSONArray releases=new JSONArray(json);
                JSONObject newest=null;
                for(int i=0;i<releases.length();i++){
                    JSONObject r=releases.getJSONObject(i);
                    if(r.optBoolean("draft")||r.optBoolean("prerelease")) continue;
                    if(!r.has("tag_name")) continue;
                    if(newest==null||compare(r.optString("tag_name"),newest.optString("tag_name"))>0) newest=r;
                }
                JSONObject result=newest;
                runOnUiThread(()->{
                    checking=false;
                    if(result!=null&&compare(result.optString("tag_name"),VERSION)>0) showUpdate(result);
                    else status.setText("ONLINE • v"+VERSION);
                });
            } catch(Exception e) {
                runOnUiThread(()->{ checking=false; status.setText("ONLINE • v"+VERSION); });
            }
        },"morok-update-check").start();
    }

    private void showUpdate(JSONObject release) {
        String version=release.optString("tag_name").replaceFirst("^[vV]","");
        JSONArray assets=release.optJSONArray("assets"); String url=null;
        if(assets!=null) for(int i=0;i<assets.length();i++){
            String n=assets.optJSONObject(i).optString("name");
            if(n.toLowerCase(Locale.ROOT).endsWith(".apk")) { url=assets.optJSONObject(i).optString("browser_download_url"); break; }
        }
        if(url==null){ status.setText("NOVA VERSÃO "+version+" • APK NÃO ENCONTRADO"); return; }
        LinearLayout box=new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL); box.setPadding(34,24,34,10);
        TextView title=label("NOVA VERSÃO DISPONÍVEL\nMOROK "+version,22,Color.WHITE);
        TextView msg=label("A atualização será baixada automaticamente. Depois o Android abrirá o instalador para concluir a instalação.",14,0xffb8b8c8);
        box.addView(title); box.addView(msg);
        AlertDialog d=new AlertDialog.Builder(this).setView(box).setPositiveButton("BAIXAR E INSTALAR",null).setNegativeButton("AGORA NÃO",null).create();
        d.setOnShowListener(x->d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{d.dismiss(); downloadAndInstall(url,version);}));
        d.show();
    }

    private void downloadAndInstall(String url,String version) {
        status.setText("BAIXANDO v"+version+"...");
        new Thread(()->{
            try {
                File dir=new File(getCacheDir(),"updates"); if(!dir.exists()&&!dir.mkdirs()) throw new IOException("cache");
                File apk=new File(dir,"morok-"+version+".apk");
                HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
                c.setInstanceFollowRedirects(true); c.setRequestProperty("User-Agent","Morok-Android/"+VERSION);
                c.setConnectTimeout(20000); c.setReadTimeout(120000); c.connect();
                if(c.getResponseCode()<200||c.getResponseCode()>=300) throw new IOException("HTTP "+c.getResponseCode());
                try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(apk)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}
                c.disconnect();
                runOnUiThread(()->installApk(apk));
            } catch(Exception e){runOnUiThread(()->status.setText("FALHA NA ATUALIZAÇÃO")); }
        },"morok-updater").start();
    }

    private void installApk(File apk) {
        if(Build.VERSION.SDK_INT>=26&&!getPackageManager().canRequestPackageInstalls()){
            new AlertDialog.Builder(this).setTitle("Permitir atualização").setMessage("O Android precisa permitir instalações de fontes externas para que o Morok conclua a atualização.").setPositiveButton("ABRIR CONFIGURAÇÃO",(d,w)->startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())))).setNegativeButton("Cancelar",null).show();
            return;
        }
        try {
            Uri uri=FileProvider.getUriForFile(this,getPackageName()+".fileprovider",apk);
            Intent i=new Intent(Intent.ACTION_INSTALL_PACKAGE); i.setDataAndType(uri,"application/vnd.android.package-archive"); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(i);
            status.setText("ATUALIZAÇÃO PRONTA PARA INSTALAÇÃO");
        } catch(Exception e){ status.setText("NÃO FOI POSSÍVEL ABRIR O INSTALADOR"); }
    }

    private void startVoice() {
        if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){requestMic();return;}
        if(!SpeechRecognizer.isRecognitionAvailable(this)){speak("Reconhecimento de voz indisponível neste dispositivo.");return;}
        if(recognizer!=null) recognizer.destroy();
        recognizer=SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener(){
            public void onReadyForSpeech(Bundle b){status.setText("OUVINDO...");}
            public void onBeginningOfSpeech(){status.setText("OUVINDO...");}
            public void onRmsChanged(float v){}
            public void onBufferReceived(byte[] b){}
            public void onEndOfSpeech(){status.setText("PROCESSANDO COMANDO...");}
            public void onError(int e){status.setText("ONLINE • v"+VERSION);}
            public void onResults(Bundle b){ArrayList<String> r=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(r!=null&&!r.isEmpty())executeCommand(r.get(0));}
            public void onPartialResults(Bundle b){}
            public void onEvent(int a,Bundle b){}
        });
        Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"pt-BR");i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);recognizer.startListening(i);
    }

    private void executeCommand(String raw){
        String s=java.text.Normalizer.normalize(raw,java.text.Normalizer.Form.NFD).replaceAll("[^\\p{ASCII}]","").toLowerCase(Locale.ROOT);
        if(s.contains("hora")){String t=new java.text.SimpleDateFormat("HH:mm",Locale.getDefault()).format(new Date());speak("Agora são "+t+".");}
        else if(s.contains("data")||s.contains("hoje")){String t=new java.text.SimpleDateFormat("dd 'de' MMMM 'de' yyyy",new Locale("pt","BR")).format(new Date());speak("Hoje é "+t+".");}
        else if(s.contains("atualiza")||s.contains("versao")||s.contains("github")){speak("Verificando atualização.");checkForUpdate();}
        else if(s.contains("projeto"))speak("Projetos.");
        else if(s.contains("seguranca"))speak("Segurança.");
        else if(s.contains("rede"))speak("Rede.");
        else speak("Comando não reconhecido.");
    }

    private void speak(String text){status.setText(text.toUpperCase(Locale.ROOT)); TextToSpeech tts=new TextToSpeech(this,s->{if(s==TextToSpeech.SUCCESS){tts.setLanguage(new Locale("pt","BR"));tts.speak(text,TextToSpeech.QUEUE_FLUSH,null,"morok");}});}

    private static String read(InputStream in)throws IOException{BufferedReader r=new BufferedReader(new InputStreamReader(in));StringBuilder b=new StringBuilder();String x;while((x=r.readLine())!=null)b.append(x);return b.toString();}
    private static int compare(String a,String b){int[] x=ver(a),y=ver(b);for(int i=0;i<3;i++)if(x[i]!=y[i])return Integer.compare(x[i],y[i]);return 0;}
    private static int[] ver(String s){s=s.replaceFirst("^[vV]","").split("[-+]")[0];String[] p=s.split("\\.");int[] v={0,0,0};for(int i=0;i<Math.min(3,p.length);i++)try{v[i]=Integer.parseInt(p[i]);}catch(Exception ignored){}return v;}
    private TextView label(String s,int size,int color){TextView v=new TextView(this);v.setText(s);v.setTextSize(size);v.setTextColor(color);v.setPadding(0,8,0,8);return v;}

    private class MorokView extends View {
        Paint p=new Paint(3); Handler h=new Handler(Looper.getMainLooper());
        MorokView(Context c){super(c);clock=new TextView(c);status=new TextView(c);}
        protected void onDraw(Canvas c){
            int w=getWidth(),hh=getHeight();c.drawColor(Color.rgb(3,3,10));
            p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);p.setColor(0xff6f45ff);
            float cx=w/2f,cy=hh*.43f,r=Math.min(w,hh)*.23f;
            for(int i=0;i<5;i++){c.drawOval(cx-r-i*13,cy-r*.38f-i*5,cx+r+i*13,cy+r*.38f+i*5,p);}
            p.setStyle(Paint.Style.FILL);p.setColor(0xff120d25);c.drawCircle(cx,cy,r*.72f,p);
            p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(3);p.setColor(0xffa46cff);c.drawCircle(cx,cy,r*.72f,p);
            p.setStyle(Paint.Style.FILL);p.setTextAlign(Paint.Align.CENTER);p.setTypeface(Typeface.create(Typeface.DEFAULT,Typeface.BOLD));
            p.setTextSize(34);p.setColor(Color.WHITE);c.drawText("MOROK",cx,cy+12,p);
            p.setTextSize(12);p.setColor(0xffa69abf);c.drawText("NÚCLEO NATIVO ANDROID",cx,cy+40,p);
            p.setTextSize(20);p.setColor(Color.WHITE);String t=new java.text.SimpleDateFormat("HH:mm:ss",Locale.getDefault()).format(new Date());c.drawText(t,cx,72,p);
            p.setTextSize(11);p.setColor(0xff8f86a8);c.drawText(status.getText().toString(),cx,hh-74,p);
            h.postDelayed(this::invalidate,1000);
        }
    }
}
