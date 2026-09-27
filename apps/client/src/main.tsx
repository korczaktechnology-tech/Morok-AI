import * as THREE from "three";
import * as satellite from "satellite.js";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "https://morok-ai.onrender.com";
const MOROK_SUB_ICON = `${import.meta.env.BASE_URL}MorokSubIcon.svg`;

type Msg = { role: "user" | "assistant"; content: string };
type Task = { id: string; title: string; status: string; dueAt?: string };
type Memory = { id: string; content: string };
type Doc = { id: string; name: string; format: string; content?: string };
type Event = { id: string; title: string; startsAt: string; endsAt?: string; notes?: string };
type ModuleKey =
  | "home"
  | "systems"
  | "documents"
  | "processes"
  | "teams"
  | "reports"
  | "chat"
  | "tasks"
  | "memory"
  | "files"
  | "calendar"
  | "contacts"
  | "notifications"
  | "automations"
  | "integrations"
  | "vault"
  | "settings";

declare global {
  interface Window {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
    morokDesktop?: {
      isAvailable?: () => Promise<boolean>;
      execute?: (action: string, payload?: unknown) => Promise<unknown>;
    };
  }
}

const nav: { key: ModuleKey; label: string; icon: string }[] = [
  { key: "home", label: "INÍCIO", icon: "⌂" },
  { key: "systems", label: "SISTEMAS", icon: "▦" },
  { key: "documents", label: "DOCUMENTOS", icon: "▤" },
  { key: "processes", label: "PROCESSOS", icon: "◌" },
  { key: "teams", label: "EQUIPES", icon: "♙" },
  { key: "reports", label: "RELATÓRIOS", icon: "▥" },
  { key: "settings", label: "CONFIGURAÇÕES", icon: "⚙" }
];

const secondary: { key: ModuleKey; label: string }[] = [
  { key: "chat", label: "MOROK AI" },
  { key: "tasks", label: "TAREFAS" },
  { key: "memory", label: "MEMÓRIA" },
  { key: "files", label: "ARQUIVOS" },
  { key: "calendar", label: "AGENDA" },
  { key: "contacts", label: "CONTATOS" },
  { key: "notifications", label: "NOTIFICAÇÕES" },
  { key: "automations", label: "AUTOMAÇÕES" },
  { key: "integrations", label: "INTEGRAÇÕES" },
  { key: "vault", label: "COFRE" }
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="navIcon" aria-hidden="true">{children}</span>;
}

function EarthGlobe(){
  const mountRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const mount=mountRef.current;
    if(!mount)return;

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.1,100);
    camera.position.z=2.65;

    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.25));
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    mount.replaceChildren(renderer.domElement);

    const earthSystem=new THREE.Group();
    scene.add(earthSystem);

    // Globo 3D real: esfera física com o mapa-múndi real aplicado como textura.
    const geometry=new THREE.SphereGeometry(1,96,96);
    const textureLoader=new THREE.TextureLoader();
    const earthTexture=textureLoader.load(
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
      (texture)=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
      }
    );

    // Iluminação simples para preservar a percepção de volume da esfera.
    const ambientLight=new THREE.AmbientLight(0xffffff,1.35);
    const keyLight=new THREE.DirectionalLight(0xffffff,1.15);
    keyLight.position.set(4,2.5,5);
    scene.add(ambientLight,keyLight);

    const material=new THREE.MeshPhongMaterial({
      map:earthTexture,
      shininess:8,
      specular:new THREE.Color(0x222222)
    });
    const earth=new THREE.Mesh(geometry,material);
    earthSystem.add(earth);

    // Fronteiras políticas reais em 3D: GeoJSON convertido diretamente
    // em linhas sobre a esfera. Não usa SVG nem imagem para desenhar os países.
    const borderGroup=new THREE.Group();
    earthSystem.add(borderGroup);
    let bordersDisposed=false;

    const addBorderRing=(coordinates:number[][])=>{
      if(coordinates.length<2)return;
      const points=coordinates.map((coordinate)=>{
        const longitude=coordinate[0] ?? 0;
        const latitude=coordinate[1] ?? 0;
        const lon=THREE.MathUtils.degToRad(longitude);
        const lat=THREE.MathUtils.degToRad(latitude);
        const radius=1.006;
        return new THREE.Vector3(
          radius*Math.cos(lat)*Math.cos(lon),
          radius*Math.sin(lat),
          -radius*Math.cos(lat)*Math.sin(lon)
        );
      });
      const borderGeometry=new THREE.BufferGeometry().setFromPoints(points);
      const borderMaterial=new THREE.LineBasicMaterial({
        color:0xffffff,
        transparent:false,
        opacity:1,
        depthTest:true,
        depthWrite:false,
        toneMapped:false,
        blending:THREE.NormalBlending
      });
      const borderLine=new THREE.Line(borderGeometry,borderMaterial);
      borderLine.renderOrder=50;
      borderGroup.add(borderLine);
    };

    const loadCountryBorders=async()=>{
      try{
        const response=await fetch(
          "https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/main/countries.geojson"
        );
        if(!response.ok)throw new Error("country_borders_failed");
        const collection=await response.json() as {
          features?:Array<{geometry?:{type?:string;coordinates?:any}}>;
        };
        if(bordersDisposed)return;

        for(const feature of collection.features??[]){
          const geometryData=feature.geometry;
          if(!geometryData?.coordinates)continue;

          if(geometryData.type==="Polygon"){
            for(const ring of geometryData.coordinates as number[][][]){
              addBorderRing(ring);
            }
          }else if(geometryData.type==="MultiPolygon"){
            for(const polygon of geometryData.coordinates as number[][][][]){
              for(const ring of polygon){
                addBorderRing(ring);
              }
            }
          }
        }
      }catch(error){
        console.warn("Não foi possível carregar as fronteiras dos países.",error);
      }
    };
    void loadCountryBorders();

    let dragging=false;
    let lastX=0;
    let lastY=0;

    const resize=()=>{
      const width=Math.max(1,mount.clientWidth);
      const height=Math.max(1,mount.clientHeight);
      // O viewport do globo é sempre quadrado. Isso impede que a esfera seja
      // esticada visualmente quando a área disponível for mais larga que alta.
      const size=Math.max(1,Math.min(width,height));
      renderer.setSize(size,size,false);
      camera.aspect=1;
      camera.updateProjectionMatrix();
      const canvas=renderer.domElement;
      // O canvas físico e o viewport CSS são deliberadamente quadrados.
      // A máscara circular garante que nenhum retângulo do canvas possa aparecer.
      canvas.style.position="absolute";
      canvas.style.width=`${size}px`;
      canvas.style.height=`${size}px`;
      canvas.style.maxWidth="none";
      canvas.style.maxHeight="none";
      canvas.style.left="50%";
      canvas.style.top="50%";
      canvas.style.right="auto";
      canvas.style.bottom="auto";
      canvas.style.transform="translate(-50%,-50%)";
      canvas.style.aspectRatio="1 / 1";
      canvas.style.clipPath="circle(50% at 50% 50%)";
    };

    const down=(e:PointerEvent)=>{
      dragging=true;
      lastX=e.clientX;
      lastY=e.clientY;
      mount.setPointerCapture(e.pointerId);
      mount.style.cursor="grabbing";
    };

    const move=(e:PointerEvent)=>{
      if(!dragging)return;
      const dx=e.clientX-lastX;
      const dy=e.clientY-lastY;
      lastX=e.clientX;
      lastY=e.clientY;
      earthSystem.rotation.y+=dx*.006;
      earthSystem.rotation.x+=dy*.0045;
      earthSystem.rotation.x=Math.max(-1.45,Math.min(1.45,earthSystem.rotation.x));
    };

    const up=(e:PointerEvent)=>{
      dragging=false;
      if(mount.hasPointerCapture(e.pointerId))mount.releasePointerCapture(e.pointerId);
      mount.style.cursor="grab";
    };

    const observer=new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    mount.addEventListener("pointerdown",down);
    mount.addEventListener("pointermove",move);
    mount.addEventListener("pointerup",up);
    mount.addEventListener("pointercancel",up);
    mount.addEventListener("pointerleave",up);

    let frame=0;
    const animate=()=>{
      frame=requestAnimationFrame(animate);
      renderer.render(scene,camera);
    };
    animate();

    return()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeEventListener("pointerdown",down);
      mount.removeEventListener("pointermove",move);
      mount.removeEventListener("pointerup",up);
      mount.removeEventListener("pointercancel",up);
      mount.removeEventListener("pointerleave",up);
      bordersDisposed=true;
      borderGroup.traverse(object=>{
        const line=object as THREE.Line;
        line.geometry?.dispose();
        const lineMaterial=line.material as THREE.Material;
        lineMaterial?.dispose();
      });
      geometry.dispose();
      material.dispose();
      earthTexture.dispose();
      scene.remove(ambientLight,keyLight);
      renderer.dispose();
      renderer.domElement.remove();
    };
  },[]);

  return (
    <div
      className="earthGlobe realEarth"
      ref={mountRef}
      aria-label="Globo real da Terra interativo"
    />
  );
}

function OrbitalRings(){
  const mountRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const mount=mountRef.current;
    if(!mount)return;

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.1,100);
    camera.position.set(0,0,6.3);

    const renderer=new THREE.WebGLRenderer({
      antialias:true,
      alpha:true,
      powerPreference:"high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000,0);
    mount.replaceChildren(renderer.domElement);

    type SatelliteDefinition={
      key:string;
      label:string;
      norad:string;
      color:number;
      periodMinutes:number;
      tleUrl:string;
    };

    const definitions:SatelliteDefinition[]=[
      {key:"sputnik1",label:"Sputnik 1",norad:"00002",color:0xffffff,periodMinutes:96.2,tleUrl:""},
      {key:"hubble",label:"Hubble",norad:"20580",color:0x7b61ff,periodMinutes:94.02,tleUrl:"https://celestrak.org/NORAD/elements/gp.php?CATNR=20580&FORMAT=TLE"},
      {key:"iss",label:"ISS",norad:"25544",color:0xff315f,periodMinutes:92.95,tleUrl:"https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"},
      {key:"gps",label:"GPS / NAVSTAR",norad:"24876",color:0x4b83ff,periodMinutes:717.97,tleUrl:"https://celestrak.org/NORAD/elements/gp.php?CATNR=24876&FORMAT=TLE"},
      {key:"voyager1",label:"Voyager 1",norad:"-31",color:0x9d65ff,periodMinutes:0,tleUrl:""},
      {key:"jwst",label:"James Webb",norad:"-170",color:0xff6685,periodMinutes:0,tleUrl:""},
      {key:"landsat1",label:"Landsat 1",norad:"06126",color:0x55a1ff,periodMinutes:103.02,tleUrl:"https://celestrak.org/NORAD/elements/gp.php?CATNR=6126&FORMAT=TLE"},
      {key:"telstar1",label:"Telstar 1",norad:"00340",color:0xc06bff,periodMinutes:157.74,tleUrl:"https://celestrak.org/NORAD/elements/gp.php?CATNR=340&FORMAT=TLE"},
      {key:"tiros1",label:"TIROS-1",norad:"00029",color:0xff416e,periodMinutes:97.38,tleUrl:"https://celestrak.org/NORAD/elements/gp.php?CATNR=29&FORMAT=TLE"}
    ];

    const earthRadiusKm=6378.137;
    const orbitGroup=new THREE.Group();
    scene.add(orbitGroup);

    type Track={
      definition:SatelliteDefinition;
      satrec?:Parameters<typeof satellite.propagate>[0];
      line:THREE.Line;
      marker:THREE.Mesh;
      points:THREE.Vector3[];
      isDeepSpace:boolean;
    };
    const tracks=new Map<string,Track>();
    let disposed=false;

    const makeMaterial=(color:number,opacity:number)=>{
      return new THREE.LineBasicMaterial({
        color,
        transparent:true,
        opacity,
        blending:THREE.AdditiveBlending,
        depthWrite:false,
        depthTest:false,
        toneMapped:false
      });
    };

    const makeTrack=(definition:SatelliteDefinition,isDeepSpace=false)=>{
      const lineGeometry=new THREE.BufferGeometry();
      const line=new THREE.Line(lineGeometry,makeMaterial(definition.color,isDeepSpace?.42:.62));
      line.renderOrder=30;
      orbitGroup.add(line);

      const marker=new THREE.Mesh(
        new THREE.SphereGeometry(isDeepSpace?.018:.013,8,8),
        new THREE.MeshBasicMaterial({
          color:definition.color,
          transparent:true,
          opacity:.95,
          blending:THREE.AdditiveBlending,
          depthWrite:false,
          depthTest:false,
          toneMapped:false
        })
      );
      marker.renderOrder=35;
      orbitGroup.add(marker);

      const track={definition,line,marker,points:[],isDeepSpace};
      tracks.set(definition.key,track);
      return track;
    };

    const sphericalScale=(x:number,y:number,z:number)=>{
      const distanceKm=Math.sqrt(x*x+y*y+z*z);
      if(distanceKm<=earthRadiusKm*8){
        return distanceKm/earthRadiusKm;
      }
      // Mantém objetos de espaço profundo visíveis no HUD sem falsificar a
      // geometria orbital: a compressão é somente visual e monotônica.
      return Math.min(2.35,1+Math.log10(Math.max(1,distanceKm/earthRadiusKm))*.34);
    };

    const eciToThree=(position:{x:number;y:number;z:number})=>{
      const distanceKm=Math.sqrt(position.x**2+position.y**2+position.z**2);
      const scale=sphericalScale(position.x,position.y,position.z);
      const factor=distanceKm>0?scale/(distanceKm/earthRadiusKm):1;
      return new THREE.Vector3(
        position.x*factor,
        position.z*factor,
        -position.y*factor
      );
    };

    const setLinePoints=(track:Track,points:THREE.Vector3[])=>{
      track.points=points;
      track.line.geometry.dispose();
      track.line.geometry=new THREE.BufferGeometry().setFromPoints(points);
      track.line.frustumCulled=false;
    };

    const staticSputnik={
      semiMajorKm:6955.2,
      eccentricity:.05201,
      inclination:THREE.MathUtils.degToRad(65.1),
      ascendingNode:THREE.MathUtils.degToRad(0),
      argumentPerigee:THREE.MathUtils.degToRad(0)
    };

    const makeKeplerOrbit=(definition:SatelliteDefinition)=>{
      const points:THREE.Vector3[]=[];
      const {semiMajorKm:a,eccentricity:e,inclination:i,ascendingNode:raan,argumentPerigee:arg}=staticSputnik;
      for(let step=0;step<=240;step++){
        const nu=(step/240)*Math.PI*2;
        const radius=a*(1-e*e)/(1+e*Math.cos(nu));
        const xOrb=radius*Math.cos(nu);
        const yOrb=radius*Math.sin(nu);
        const cosO=Math.cos(raan),sinO=Math.sin(raan);
        const cosI=Math.cos(i),sinI=Math.sin(i);
        const cosW=Math.cos(arg),sinW=Math.sin(arg);
        const x=(cosO*cosW-sinO*sinW*cosI)*xOrb+(-cosO*sinW-sinO*cosW*cosI)*yOrb;
        const y=(sinO*cosW+cosO*sinW*cosI)*xOrb+(-sinO*sinW+cosO*cosW*cosI)*yOrb;
        const z=(sinW*sinI)*xOrb+(cosW*sinI)*yOrb;
        points.push(eciToThree({x,y,z}));
      }
      const track=makeTrack(definition,false);
      setLinePoints(track,points);
      track.marker.visible=false;
    };

    makeKeplerOrbit(definitions[0]!);

    const parseTle=(text:string)=>{
      const lines=text.split(/\\r?\\n/).map(line=>line.trim()).filter(Boolean);
      const line1=lines.find(line=>line.startsWith("1 "));
      const line2=lines.find(line=>line.startsWith("2 "));
      if(!line1||!line2)throw new Error("invalid_tle");
      return {line1,line2};
    };

    const refreshTleTrack=async(definition:SatelliteDefinition)=>{
      if(!definition.tleUrl||disposed)return;
      try{
        const response=await fetch(definition.tleUrl,{cache:"no-store"});
        if(!response.ok)throw new Error("tle_fetch_failed");
        const tle=parseTle(await response.text());
        const satrec=satellite.twoline2satrec(tle.line1,tle.line2);
        if(disposed)return;

        let track=tracks.get(definition.key);
        if(!track)track=makeTrack(definition,false);
        track.satrec=satrec;

        const now=new Date();
        const span=Math.max(90,definition.periodMinutes*1.15);
        const points:THREE.Vector3[]=[];
        for(let minute=-span/2;minute<=span/2;minute+=Math.max(.75,span/180)){
          const date=new Date(now.getTime()+minute*60000);
          const propagated=satellite.propagate(satrec,date);
          if(!propagated||!propagated.position)continue;
          points.push(eciToThree(propagated.position));
        }
        if(points.length>1)setLinePoints(track,points);
      }catch(error){
        console.warn(`Não foi possível atualizar a órbita de ${definition.label}.`,error);
      }
    };

    const refreshDeepSpace=async(definition:SatelliteDefinition)=>{
      if(disposed)return;
      try{
        const now=new Date();
        const start=new Date(now.getTime()-15*86400000);
        const stop=new Date(now.getTime()+15*86400000);
        const url=new URL("https://ssd.jpl.nasa.gov/api/horizons.api");
        url.searchParams.set("format","json");
        url.searchParams.set("COMMAND",`'${definition.norad}'`);
        url.searchParams.set("OBJ_DATA","NO");
        url.searchParams.set("MAKE_EPHEM","YES");
        url.searchParams.set("EPHEM_TYPE","VECTORS");
        url.searchParams.set("CENTER","500@399");
        url.searchParams.set("START_TIME",`'${start.toISOString().slice(0,10)}'`);
        url.searchParams.set("STOP_TIME",`'${stop.toISOString().slice(0,10)}'`);
        url.searchParams.set("STEP_SIZE","1 d");
        url.searchParams.set("OUT_UNITS","KM-S");
        url.searchParams.set("VEC_TABLE","1");
        url.searchParams.set("VEC_LABELS","NO");
        url.searchParams.set("CSV_FORMAT","YES");

        const response=await fetch(url.toString(),{cache:"no-store"});
        if(!response.ok)throw new Error("horizons_fetch_failed");
        const data=await response.json();
        const text=String(data?.result??"");
        const match=text.match(/\\$\\$SOE([\\s\\S]*?)\\$\\$EOE/);
        const csvSection=match?.[1];
        if(!csvSection)throw new Error("horizons_empty");

        const points:THREE.Vector3[]=[];
        for(const row of csvSection.split(/\\r?\\n/)){
          const fields=row.split(",").map(v=>v.trim());
          const nums=fields.map(v=>Number(v));
          const numeric=nums.filter((v):v is number=>Number.isFinite(v));
          if(numeric.length<3)continue;
          const x=numeric[numeric.length-3];
          const y=numeric[numeric.length-2];
          const z=numeric[numeric.length-1];
          if(x===undefined||y===undefined||z===undefined)continue;
          points.push(eciToThree({x,y,z}));
        }

        if(points.length>1){
          let track=tracks.get(definition.key);
          if(!track)track=makeTrack(definition,true);
          setLinePoints(track,points);
        }
      }catch(error){
        console.warn(`Não foi possível atualizar a trajetória de ${definition.label}.`,error);
      }
    };

    const refreshAll=()=>{
      for(const definition of definitions){
        if(definition.key==="sputnik1")continue;
        if(definition.key==="voyager1"||definition.key==="jwst"){
          void refreshDeepSpace(definition);
        }else{
          void refreshTleTrack(definition);
        }
      }
    };
    refreshAll();
    const refreshTimer=window.setInterval(refreshAll,15*60*1000);

    const resize=()=>{
      const w=Math.max(1,mount.clientWidth);
      const h=Math.max(1,mount.clientHeight);
      camera.aspect=w/h;
      camera.updateProjectionMatrix();
      renderer.setSize(w,h,false);
    };
    const resizeObserver=new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let raf=0;
    const animate=()=>{
      if(disposed)return;
      raf=requestAnimationFrame(animate);
      const now=new Date();

      tracks.forEach(track=>{
        if(!track.satrec)return;
        const propagated=satellite.propagate(track.satrec,now);
        if(!propagated||!propagated.position){
          track.marker.visible=false;
          return;
        }
        track.marker.visible=true;
        track.marker.position.copy(eciToThree(propagated.position));
      });

      renderer.render(scene,camera);
    };
    animate();

    return()=>{
      disposed=true;
      window.clearInterval(refreshTimer);
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      scene.traverse(object=>{
        const mesh=object as THREE.Mesh|THREE.Line;
        mesh.geometry?.dispose();
        const material=mesh.material as THREE.Material|THREE.Material[];
        if(Array.isArray(material))material.forEach(item=>item.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  },[]);

  return <div className="orbitalLayer" ref={mountRef} aria-hidden="true" />;
}

function Dashboard() {
  return (
    <div className="dashboard cleanCommandCenter">
      <section className="heroCore">
        <EarthGlobe />
        <OrbitalRings />
      </section>
    </div>
  );
}

function MobileDashboard({onOpenChat}:{onOpenChat:()=>void}){
  const activities=[
    ["11:41","Projeto KOS atualizado","blue"],
    ["11:32","Backup concluído","green"],
    ["10:58","Firewall ativo","purple"],
    ["10:23","Conexão com servidor","cyan"],
    ["09:17","Análise de segurança","red"]
  ];
  const projects=[
    ["KOS - Core System","Desenvolvimento","78%","78"],
    ["KOS - Integrações","Testes","43%","43"],
    ["Infraestrutura Cloud","Implantação","58%","58"]
  ];
  return <div className="mobileMorok">
    <header className="mobileTop">
      <div className="mobileStatus"><span>11:42</span><i>➤</i></div>
      <div className="mobileHeaderPanel">
        <div className="mobileBrand"><div className="mobileLogo"><img src={MOROK_SUB_ICON} alt="Morok" /></div><div><b>MOROK</b><small>IA ASSISTENTE DO KOS</small><em><span/> ONLINE <strong>|</strong> v2.8.4</em></div></div>
        <div className="mobileKos"><b>✦ KOS</b><small>KORCZAK<br/>OPERATIONAL<br/>SYSTEM</small></div>
        <div className="mobileDate"><span>14 SET 2025</span><b>11:42:17</b></div>
      </div>
    </header>

    <main className="mobileBody">
      <aside className="mobileSide">
        <b>SISTEMAS</b><span>PROJETOS</span><span>REDE</span><span>SEGURANÇA</span><span>ANALYTICS</span><i/>
        <p>“Mais do que<br/>tecnologia,<br/>é sobre<br/>o que você<br/>constrói.”</p><small>— MOROK</small>
      </aside>

      <section className="mobileCore">
        <button className="mobileCoreRings" type="button" onClick={onOpenChat} aria-label="Abrir conversa com o Morok">
          <span className="mobileCoreOrbit orbitA" />
          <span className="mobileCoreOrbit orbitB" />
          <span className="mobileCoreOrbit orbitC" />
          <span className="mobileCoreOrbit orbitD" />
          <span className="mobileCoreOrbit orbitE" />
          <span className="mobileCoreCrosshair crosshairH" />
          <span className="mobileCoreCrosshair crosshairV" />
          <span className="mobileCoreNode nodeTop" />
          <span className="mobileCoreNode nodeRight" />
          <span className="mobileCoreNode nodeBottom" />
          <span className="mobileCoreNode nodeLeft" />
          <span className="mobileCoreGlyph"><img src={MOROK_SUB_ICON} alt="Abrir conversa com o Morok" /></span>
          <b>MOROK</b>
          <span className="mobileCoreHint">TOQUE PARA CONVERSAR</span>
          <i>⌁⌁⌁</i>
        </button>
      </section>

      <aside className="mobileTelemetry">
        {[
          ["CPU","34%","cpu"],["RAM","61%","ram"],["DISCO","42%","disk"],["GPU","28%","gpu"]
        ].map(([label,value,type])=><div className={"mTelemetry "+type} key={label}><div className="mGauge"><b>{value}</b></div><section><b>{label}</b><i/><div className="mSpark"/></section></div>)}
        <div className="mSimpleStat"><b>♨</b><span>TEMP.<strong>42°C</strong></span></div>
        <div className="mSimpleStat"><b>◎</b><span>REDE<strong>98%</strong></span><i>▁▃▅▆▇</i></div>
      </aside>

      <section className="mobileRecent panelFrame">
        <h3>◷ <span>ATIVIDADE RECENTE</span></h3>
        {activities.map(([time,title,color])=><div className="mActivity" key={time}><i className={color}/><time>{time}</time><span>{title}</span></div>)}
      </section>

      <section className="mobileKosCard panelFrame">
        <b>KOS</b><em><span/> OPERACIONAL</em><p>Todos os sistemas funcionando normalmente.</p><i/><strong>↗</strong>
      </section>

      <nav className="mobileQuick">
        {[
          ["▦","PROJETOS","ACESSAR"],["☁","ARQUIVOS","ABRIR"],["♢","SEGURANÇA","PAINEL"],["◎","REDE","MONITORAR"],["⚙","UTILITÁRIOS","FERRAMENTAS"]
        ].map(([icon,title,sub])=><button key={title}><i>{icon}</i><b>{title}</b><small>{sub}</small></button>)}
      </nav>

      <section className="mobileProjects panelFrame">
        <h3>▱ <span>PROJETOS EM ANDAMENTO</span><em>3</em></h3>
        {projects.map(([title,meta,value,width])=><div className="mProject" key={title}><i>◇</i><div><b>{title}</b><small>{meta}</small></div><section><span><i style={{width:width+"%"}}/></span><b>{value}</b></section><strong>›</strong></div>)}
      </section>

      <section className="mobileEcosystem panelFrame">
        <div className="mEcoOrb">✦</div><div><b>KOS</b><small>ECOSSISTEMA INTEGRADO</small><p>Infraestrutura, processos<br/>e pessoas em um só lugar.</p><i/></div><button>↗ &nbsp; VER MAIS</button>
      </section>
    </main>
    <div className="mobileHomeBar"/>
  </div>;
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.1.0";
const GITHUB_RELEASES = "https://api.github.com/repos/korczaktechnology-tech/Morok-AI/releases?per_page=20";

function normalizeVersion(value:string){
  const base=value.trim().replace(/^v/i,"").split("-")[0]?.split("+")[0] ?? "";
  return base.split(".").map(x=>Number.parseInt(x,10)||0).slice(0,3).concat([0,0,0]).slice(0,3);
}
function compareVersions(a:string,b:string){
  const av=normalizeVersion(a),bv=normalizeVersion(b);
  for(let i=0;i<3;i++){ const ai=av[i] ?? 0; const bi=bv[i] ?? 0; if(ai>bi)return 1; if(ai<bi)return -1; }
  return 0;
}

function UpdateChecker(){
  const [update,setUpdate]=useState<{version:string;url:string;notes:string}|null>(null);

  // O verificador de atualização pertence somente ao aplicativo nativo mobile.
  // Desktop/web não deve consultar nem exibir a tela de atualização.
  const isMobileApp = Capacitor.isNativePlatform() && (Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios");
  const [checking,setChecking]=useState(false);

  useEffect(()=>{
    if(!isMobileApp)return;
    let active=true;
    const check=async()=>{
      if(checking)return;
      setChecking(true);
      try{
        const response=await fetch(GITHUB_RELEASES,{
          headers:{Accept:"application/vnd.github+json"},
          cache:"no-store"
        });
        if(!response.ok)return;
        const releases=await response.json();
        if(!active || !Array.isArray(releases))return;

        const release=releases
          .filter((item:any)=>item && !item.draft && !item.prerelease && item.tag_name)
          .sort((a:any,b:any)=>compareVersions(String(b.tag_name),String(a.tag_name)))[0];

        if(!release || compareVersions(String(release.tag_name),APP_VERSION)<=0)return;

        const apk=Array.isArray(release.assets)
          ? release.assets.find((asset:any)=>String(asset?.name||"").toLowerCase().endsWith(".apk"))
          : null;
        const url=apk?.browser_download_url || release.html_url;
        if(url && active){
          setUpdate({
            version:String(release.tag_name).replace(/^v/i,""),
            url,
            notes:String(release.body||"")
          });
        }
      }catch{}
      finally{
        if(active)setChecking(false);
      }
    };

    check();
    const onVisibility=()=>{if(document.visibilityState==="visible")check();};
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{
      active=false;
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[]);

  if(!isMobileApp || !update)return null;
  return <div className="morokUpdateOverlay" role="dialog" aria-modal="true" aria-label="Atualização disponível">
    <div className="morokUpdatePanel">
      <div className="morokUpdateCore"><span>M</span></div>
      <small>NOVA VERSÃO DISPONÍVEL</small>
      <h2>MOROK {update.version}</h2>
      <p>Uma versão mais recente do Morok foi encontrada no GitHub.</p>
      {update.notes && <div className="morokUpdateNotes">{update.notes.slice(0,700)}</div>}
      <div className="morokUpdateCurrent">VERSÃO ATUAL <b>{APP_VERSION}</b></div>
      <div className="morokUpdateActions">
        <button className="morokUpdateButton" onClick={()=>window.location.href=update.url}>ATUALIZAR AGORA</button>
        <button className="morokUpdateLater" onClick={()=>setUpdate(null)}>AGORA NÃO</button>
      </div>
    </div>
  </div>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("morok_token") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("OFFLINE");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [tab, setTab] = useState<ModuleKey>("home");
  const [notice, setNotice] = useState("");
  const [conversationId, setConversationId] = useState(localStorage.getItem("morok_conversation") ?? "");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [secretCount, setSecretCount] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [localAgent, setLocalAgent] = useState(false);
  const [brasiliaTime, setBrasiliaTime] = useState("00:00:00");
  const [brasiliaDate, setBrasiliaDate] = useState("00/00/0000");
  const [temperature, setTemperature] = useState<string | null>(null);
  const [weatherPlace, setWeatherPlace] = useState("LOCALIZAÇÃO NÃO DISPONÍVEL");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const speech = useMemo(() => {
    const C = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    return C ? new C() : null;
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setBrasiliaTime(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now));
      setBrasiliaDate(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(now));
    };
    tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m&timezone=auto`);
        if (!r.ok) return; const d = await r.json();
        if (Number.isFinite(d.current?.temperature_2m)) setTemperature(`${Math.round(d.current.temperature_2m)}°C`);
        setWeatherPlace(`${coords.latitude.toFixed(1)}°, ${coords.longitude.toFixed(1)}°`);
      } catch {}
    }, () => setWeatherPlace("LOCALIZAÇÃO BLOQUEADA"), { timeout: 8000, maximumAge: 300000 });
  }, []);

  useEffect(() => {
    fetch(API + "/health").then(r => setStatus(r.ok ? "ONLINE" : "OFFLINE")).catch(() => setStatus("OFFLINE"));
    window.morokDesktop?.isAvailable?.().then(Boolean).then(setLocalAgent).catch(() => setLocalAgent(false));
  }, []);

  useEffect(() => () => {
    speech?.stop();
    window.speechSynthesis?.cancel();
  }, [speech]);

  async function request(path: string, init: RequestInit = {}) {
    const r = await fetch(API + path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {})
      }
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error ?? "request_failed");
    return d;
  }

  async function auth(path: string) {
    setLoading(true);
    try {
      const d = await request(path, { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("morok_token", d.token);
      setToken(d.token);
      setNotice("Acesso autorizado");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation() {
    if (!conversationId) return;
    try {
      const d = await request("/api/v1/conversations/" + conversationId);
      setMessages((d.conversation.messages ?? [])
        .filter((m: any) => m.role === "user" || m.role === "assistant")
        .map((m: any) => ({ role: m.role, content: m.content })));
    } catch {}
  }

  async function loadData() {
    try {
      const [t, cal, m, d, v, c, n, a, i, fl] = await Promise.all([
        request("/api/v1/tasks"), request("/api/v1/calendar"), request("/api/v1/memories"),
        request("/api/v1/documents"), request("/api/v1/vault"), request("/api/v1/contacts"),
        request("/api/v1/notifications"), request("/api/v1/automations"),
        request("/api/v1/integrations"), request("/api/v1/files")
      ]);
      setTasks(t.tasks ?? []); setEvents(cal.events ?? []); setMemories(m.memories ?? []);
      setDocs(d.documents ?? []); setSecretCount((v.secrets ?? []).length);
      setContacts(c.contacts ?? []); setNotifications(n.notifications ?? []);
      setAutomations(a.automations ?? []); setIntegrations(i.integrations ?? []); setFiles(fl.files ?? []);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao carregar dados");
    }
  }

  useEffect(() => {
    if (token) { void loadConversation(); void loadData(); }
  }, [token]);

  async function send(text = input) {
    if (!text.trim() || !token || loading) return;
    const value = text.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: value }, { role: "assistant", content: "" }]);
    setLoading(true);
    try {
      const params = new URLSearchParams({ message: value, ...(conversationId ? { conversationId } : {}) });
      const r = await fetch(API + "/api/v1/messages/stream?" + params.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok || !r.body) throw new Error("stream_failed");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", full = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const d = JSON.parse(payload);
            if (d.conversationId && !conversationId) {
              setConversationId(d.conversationId);
              localStorage.setItem("morok_conversation", d.conversationId);
            }
            if (d.chunk) {
              full += d.chunk;
              setMessages(m => { const copy = [...m]; copy[copy.length - 1] = { role: "assistant", content: full }; return copy; });
            }
          } catch {}
        }
      }
      if (speaking && full) window.speechSynthesis?.speak(new SpeechSynthesisUtterance(full));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha de comunicação");
      setMessages(m => m.slice(0, -1));
    } finally { setLoading(false); }
  }

  function startVoice() {
    if (!speech) { setNotice("Reconhecimento de voz não suportado neste navegador"); return; }
    speech.lang = "pt-BR"; speech.continuous = false; speech.interimResults = false;
    speech.onstart = () => setListening(true); speech.onend = () => setListening(false);
    speech.onresult = (e: any) => { const text = e.results[0]?.[0]?.transcript ?? ""; setInput(text); void send(text); };
    speech.start();
  }

  async function addTask() {
    const title = window.prompt("Título da tarefa"); if (!title) return;
    try { const d = await request("/api/v1/tasks", { method: "POST", body: JSON.stringify({ title }) }); setTasks(x => [d.task, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function completeTask(id: string) {
    try { await request("/api/v1/tasks/" + id + "/complete", { method: "POST" }); setTasks(x => x.map(t => t.id === id ? { ...t, status: "completed" } : t)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addEvent() {
    const title = window.prompt("Título do evento"); if (!title) return;
    const startsAt = window.prompt("Início (ISO 8601)", new Date().toISOString()); if (!startsAt) return;
    try { const d = await request("/api/v1/calendar", { method: "POST", body: JSON.stringify({ title, startsAt }) }); setEvents(x => [d.event, ...x].sort((a,b) => a.startsAt.localeCompare(b.startsAt))); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addContact() {
    const name = window.prompt("Nome do contato"); if (!name) return;
    try { const d = await request("/api/v1/contacts", { method: "POST", body: JSON.stringify({ name, email: window.prompt("E-mail") ?? undefined, phone: window.prompt("Telefone") ?? undefined }) }); setContacts(x => [d.contact, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addNotification() {
    const content = window.prompt("Notificação"); if (!content) return;
    try { const d = await request("/api/v1/notifications", { method: "POST", body: JSON.stringify({ content }) }); setNotifications(x => [d.notification, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addAutomation() {
    const name = window.prompt("Nome da automação"); if (!name) return;
    const type = window.prompt("Gatilho: interval ou at", "interval"); if (type !== "interval" && type !== "at") return;
    const value = window.prompt(type === "interval" ? "Intervalo em segundos" : "Data/hora ISO"); if (!value) return;
    const actionType = window.prompt("Ação: notification.create ou task.create", "notification.create");
    if (actionType !== "notification.create" && actionType !== "task.create") return;
    const content = window.prompt(actionType === "task.create" ? "Título da tarefa" : "Conteúdo da notificação"); if (!content) return;
    try {
      const d = await request("/api/v1/automations", { method: "POST", body: JSON.stringify({ name, trigger: { type, value }, action: { type: actionType, input: actionType === "task.create" ? { title: content } : { content } } }) });
      setAutomations(x => [d.automation, ...x]);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function toggleAutomation(a: any) {
    try { const d = await request("/api/v1/automations/" + a.id, { method: "PATCH", body: JSON.stringify({ enabled: !a.enabled }) }); setAutomations(x => x.map(v => v.id === a.id ? d.automation : v)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addSecret() {
    const name = window.prompt("Nome da credencial"); if (!name) return;
    const value = window.prompt("Valor secreto"); if (!value) return;
    try { await request("/api/v1/vault", { method: "POST", body: JSON.stringify({ name, value, kind: "credential" }) }); setSecretCount(x => x + 1); setNotice("Credencial armazenada"); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function toggleIntegration(a: any) {
    try { const d = await request("/api/v1/integrations/" + a.id, { method: "PATCH", body: JSON.stringify({ enabled: !a.enabled }) }); setIntegrations(x => x.map(v => v.id === a.id ? d.integration : v)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addIntegration() {
    const name = window.prompt("Nome da integração"); if (!name) return;
    const endpoint = window.prompt("Endpoint HTTPS"); if (!endpoint) return;
    const secret = window.prompt("Bearer/token"); if (!secret) return;
    try { const d = await request("/api/v1/integrations", { method: "POST", body: JSON.stringify({ name, endpoint, secret, type: "webhook" }) }); setIntegrations(x => [d.integration, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addFile() {
    const name = window.prompt("Nome do arquivo"); if (!name) return;
    const content = window.prompt("Conteúdo do arquivo", "") ?? "";
    try { const d = await request("/api/v1/files", { method: "POST", body: JSON.stringify({ name, mimeType: "text/plain", contentBase64: btoa(unescape(encodeURIComponent(content))) }) }); setFiles(x => [d.file, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function deleteFile(id: string) {
    try { await request("/api/v1/files/" + id, { method: "DELETE" }); setFiles(x => x.filter(v => v.id !== id)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function deleteDoc(id: string) {
    try { await request("/api/v1/documents/" + id, { method: "DELETE" }); setDocs(x => x.filter(v => v.id !== id)); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addMemory() {
    const content = window.prompt("Memória"); if (!content) return;
    try { const d = await request("/api/v1/memories", { method: "POST", body: JSON.stringify({ content }) }); setMemories(x => [d.memory, ...x]); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function addDoc() {
    const name = window.prompt("Nome do documento", "novo.md"); if (!name) return;
    const content = window.prompt("Conteúdo", "") ?? "";
    try {
      const format = name.endsWith(".json") ? "json" : name.endsWith(".csv") ? "csv" : name.endsWith(".html") ? "html" : name.endsWith(".txt") ? "text" : "markdown";
      const d = await request("/api/v1/documents", { method: "POST", body: JSON.stringify({ name, format, content }) }); setDocs(x => [d.document, ...x]);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  async function openDoc(id: string) {
    try {
      const d = await request("/api/v1/documents/" + id); const next = window.prompt("Editar documento", d.document.content);
      if (next === null) return;
      const u = await request("/api/v1/documents/" + id, { method: "PATCH", body: JSON.stringify({ content: next }) });
      setDocs(x => x.map(v => v.id === id ? u.document : v));
    } catch (e) { setNotice(e instanceof Error ? e.message : "Falha"); }
  }
  function logout() { localStorage.removeItem("morok_token"); setToken(""); setMessages([]); }

  if (!token) return (
    <main className="loginShell">
      <div className="loginGlow glowOne" /><div className="loginGlow glowTwo" />
      <section className="loginPanel">
        <div className="brandMark"><span className="brandHex"><img src={MOROK_SUB_ICON} alt="Morok" /></span><div><strong>MOROK</strong><small>PERSONAL INTELLIGENCE SYSTEM</small></div></div>
        <div className="loginOrb"><span /></div>
        <p className="eyebrow">SECURE CORE ACCESS / LINUX READY</p>
        <h1>Acesse o núcleo.</h1>
        <p className="loginCopy">Interface operacional do Morok. A mesma camada visual poderá ser executada no aplicativo desktop.</p>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-MAIL" />
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="SENHA" />
        <div className="loginActions"><button onClick={() => void auth("/api/v1/auth/login")} disabled={loading}>ENTRAR</button><button className="ghost" onClick={() => void auth("/api/v1/auth/register")} disabled={loading}>CRIAR CONTA</button></div>
        <p className="loginHint">{notice || "Conexão criptografada com o núcleo Morok."}</p>
      </section>
    </main>
  );

  const unread = notifications.length;
  const activeTasks = tasks.filter(t => t.status !== "completed").length;
  const activeAutomations = automations.filter(a => a.enabled).length;
  const memoryCount = memories.length;
  const title = nav.find(x => x.key === tab)?.label ?? secondary.find(x => x.key === tab)?.label ?? "MOROK AI";


  return (
    <>
      <UpdateChecker />
      <main className="appShell">
        <section className="mainStage">
          <div className="desktopDashboard"><Dashboard /></div><div className="mobileDashboard"><MobileDashboard onOpenChat={()=>setMobileChatOpen(true)} /></div>
          {mobileChatOpen && <div className="mobileChatOverlay"><div className="mobileChatShell"><button className="mobileChatClose" type="button" onClick={()=>setMobileChatOpen(false)} aria-label="Fechar conversa">×</button><Chat messages={messages} input={input} setInput={setInput} send={(v)=>void send(v)} loading={loading} startVoice={startVoice} listening={listening} speaking={speaking} setSpeaking={setSpeaking} /></div></div>}
        </section>
      </main>
    </>
  );

function Telemetry(p:{label:string;value:string;width:string;icon:string}){return <div className="telemetryCard"><Icon>{p.icon}</Icon><div><div><span>{p.label}</span><b>{p.value}</b></div><div className="bar"><i style={{width:p.width}} /></div></div></div>}
function Panel(p:{title:string;children:React.ReactNode}){return <div className="holoPanel"><div className="panelTitle"><span>{p.title}</span><i /></div>{p.children}</div>}
function Stat(p:{label:string;value:string}){return <div><small>{p.label}</small><b>{p.value}</b></div>}
function Item(p:{title:string;meta:string;children?:React.ReactNode}){return <div className="dataItem"><div><b>{p.title}</b><small>{p.meta}</small></div><div className="itemActions">{p.children}</div></div>}
function Module(p:{title:string;action?:()=>void;children:React.ReactNode}){return <section className="modulePanel"><div className="moduleHeader"><div><span className="eyebrow">MOROK CORE MODULE</span><h2>{p.title}</h2></div>{p.action&&<button onClick={p.action}>+ NOVO</button>}</div><div className="dataList">{p.children}</div></section>}

function Systems({setTab}:{setTab:(x:ModuleKey)=>void}){const systems=[["KORCZAK ERP","GESTÃO EMPRESARIAL","▦"],["KORCZAK FLOW","AUTOMAÇÃO DE PROCESSOS","⌁"],["KORCZAK OPS","OPERAÇÃO E PRODUÇÃO","◈"],["KORCZAK VISION","GESTÃO VISUAL","◎"],["KORCZAK CONNECT","INTEGRAÇÕES","♧"],["KORCZAK MOBILE","OPERAÇÃO MÓVEL","▣"],["MOROK AI","ASSISTENTE INTELIGENTE","✦"],["KORCZAK DOCUMENTS","GESTÃO DOCUMENTAL","▤"]];return <section className="systemsGrid">{systems.map(([name,desc,icon],i)=><button className="systemCard" key={name} onClick={()=>setTab(i===6?"chat":i===7?"documents":"processes")}><span>{icon}</span><div><b>{name}</b><small>{desc}</small></div><i>↗</i></button>)}</section>}
function Processes({tasks,automations,integrations}:{tasks:Task[];automations:any[];integrations:any[]}){return <section className="reportGrid"><Panel title="PROCESSOS EM EXECUÇÃO"><div className="bigNumber">{tasks.filter(t=>t.status!=="completed").length}</div><span className="muted">tarefas pendentes</span></Panel><Panel title="AUTOMAÇÕES ATIVAS"><div className="bigNumber">{automations.filter(a=>a.enabled).length}</div><span className="muted">rotinas habilitadas</span></Panel><Panel title="INTEGRAÇÕES"><div className="bigNumber">{integrations.length}</div><span className="muted">conexões configuradas</span></Panel><Panel title="ESTADO OPERACIONAL"><div className="statusMatrix"><span>API <b>ONLINE</b></span><span>IA <b>READY</b></span><span>DB <b>CONNECTED</b></span><span>AGENTE <b>PREPARED</b></span></div></Panel></section>}
function Teams({contacts}:{contacts:any[]}){return <Module title="Equipes e contatos"><div className="teamHero"><div className="teamCore">♙</div><div><b>REDE OPERACIONAL</b><p>{contacts.length} contatos registrados no núcleo atual.</p></div></div>{contacts.slice(0,8).map(c=><Item key={c.id} title={c.name} meta={c.email??c.phone??"SEM CONTATO"} />)}</Module>}
function Reports({tasks,events,docs}:{tasks:Task[];events:Event[];docs:Doc[]}){return <section className="reportGrid"><Panel title="TAREFAS"><div className="bigNumber">{tasks.length}</div><span className="muted">registros</span></Panel><Panel title="AGENDA"><div className="bigNumber">{events.length}</div><span className="muted">eventos</span></Panel><Panel title="DOCUMENTOS"><div className="bigNumber">{docs.length}</div><span className="muted">arquivos documentais</span></Panel><Panel title="PERFORMANCE"><div className="chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small>atividade do núcleo</small></Panel></section>}
function Chat(p:{messages:Msg[];input:string;setInput:(v:string)=>void;send:(v?:string)=>void;loading:boolean;startVoice:()=>void;listening:boolean;speaking:boolean;setSpeaking:(v:boolean)=>void}){return <section className="chatPanel"><div className="chatHeader"><div className="miniOrb"><span/></div><div><b>MOROK</b><small>ASSISTENTE VIRTUAL · {p.loading?"PROCESSANDO":"PRONTO"}</small></div><button onClick={()=>p.setSpeaking(!p.speaking)}>VOZ {p.speaking?"ON":"OFF"}</button></div><div className="chatMessages">{p.messages.length===0?<div className="emptyChat"><div className="miniOrb large"><span/></div><b>Olá, Korczak.</b><span>Estou pronto para analisar, planejar, executar e monitorar.</span></div>:p.messages.map((m,i)=><article className={m.role} key={i}><small>{m.role==="user"?"VOCÊ":"MOROK"}</small><p>{m.content||"PROCESSANDO..."}</p></article>)}</div><form onSubmit={e=>{e.preventDefault();p.send()}}><button type="button" className={p.listening?"voice active":"voice"} onClick={p.startVoice}>◉</button><input value={p.input} onChange={e=>p.setInput(e.target.value)} placeholder="Digite uma instrução para o Morok..." /><button disabled={p.loading||!p.input.trim()}>ENVIAR</button></form></section>}
function Settings(p:{speaking:boolean;setSpeaking:(v:boolean)=>void;secretCount:number;newConversation:()=>void;localAgent:boolean;notice:string}){return <Module title="Configurações"><Item title="Voz do Morok" meta={p.speaking?"SÍNTESE DE VOZ ATIVA":"SÍNTESE DE VOZ DESATIVADA"}><button onClick={()=>p.setSpeaking(!p.speaking)}>{p.speaking?"DESATIVAR":"ATIVAR"}</button></Item><Item title="Cofre seguro" meta={p.secretCount+" credenciais armazenadas"} /><Item title="Agente local" meta={p.localAgent?"DESKTOP DISPONÍVEL":"INTERFACE PREPARADA PARA AGENTE DESKTOP"} /><Item title="Conversa" meta="Limpar contexto local"><button onClick={p.newConversation}>NOVA CONVERSA</button></Item><div className="settingsNotice">{p.notice}</div></Module>}
}


createRoot(document.getElementById("root")!).render(<App />);
