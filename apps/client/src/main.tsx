import * as THREE from "three";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "https://morok-ai.onrender.com";
const MOROK_SUB_ICON = "/MorokSubIcon.png";

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
    const camera=new THREE.PerspectiveCamera(34,1,0.1,100);
    camera.position.set(0,0,6.3);

    const renderer=new THREE.WebGLRenderer({
      antialias:true,
      alpha:true,
      powerPreference:"high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000,0);
    mount.appendChild(renderer.domElement);

    const earthSystem=new THREE.Group();
    earthSystem.rotation.x=-0.12;
    earthSystem.rotation.y=-0.48;
    scene.add(earthSystem);

    const earthTexture=new THREE.TextureLoader().load(
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"
    );
    earthTexture.colorSpace=THREE.SRGBColorSpace;
    earthTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());

    /*
     * HOLOGRAPHIC EARTH
     * The geographic texture remains the source of truth for the continents.
     * Instead of painting the texture onto a normal sphere, the shader converts
     * the real landmass into transparent projection fragments, scanlines and
     * coast contours. A second particle layer breaks the projection into
     * visible holographic points. This is intentionally NOT a blue-tinted globe.
     */
    const hologramSurface=new THREE.ShaderMaterial({
      uniforms:{
        uMap:{value:earthTexture},
        uTime:{value:0},
        uTexel:{value:new THREE.Vector2(1/2048,1/2048)}
      },
      vertexShader:`
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main(){
          vUv=uv;
          vNormal=normalize(normalMatrix*normal);
          vec4 worldPosition=modelMatrix*vec4(position,1.0);
          vWorldPosition=worldPosition.xyz;
          gl_Position=projectionMatrix*viewMatrix*worldPosition;
        }
      `,
      fragmentShader:`
        uniform sampler2D uMap;
        uniform float uTime;
        uniform vec2 uTexel;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        float landMask(vec3 c){
          float green=c.g-(c.b*0.78+c.r*0.10);
          float warm=(c.r+c.g)*0.42-c.b*0.52;
          float brightness=dot(c,vec3(.299,.587,.114));
          float chroma=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));
          return smoothstep(.015,.085,max(green,warm))*
                 smoothstep(.08,.62,brightness+.35*chroma);
        }

        float landAt(vec2 uv){
          return landMask(texture2D(uMap,fract(uv)).rgb);
        }

        float coastAt(vec2 uv){
          float c=landAt(uv);
          float l=landAt(uv-vec2(uTexel.x*2.4,0.0));
          float r=landAt(uv+vec2(uTexel.x*2.4,0.0));
          float d=landAt(uv-vec2(0.0,uTexel.y*2.4));
          float u=landAt(uv+vec2(0.0,uTexel.y*2.4));
          return clamp(abs(c-l)+abs(c-r)+abs(c-d)+abs(c-u),0.0,1.0);
        }

        float hash21(vec2 p){
          p=fract(p*vec2(127.1,311.7));
          p+=dot(p,p+41.7);
          return fract(p.x*p.y);
        }

        void main(){
          float land=landAt(vUv);
          float coast=coastAt(vUv);

          // Hologram projection is strongest on the visible hemisphere.
          float facing=smoothstep(-.12,.52,vNormal.z);
          float edgeFade=smoothstep(.01,.28,facing);

          // Multi-spectrum projection: violet, electric blue and cyan,
          // with tiny magenta/red interference instead of a flat blue tint.
          vec3 violet=vec3(.62,.12,1.0);
          vec3 blue=vec3(.10,.38,1.0);
          vec3 cyan=vec3(.05,.95,1.0);
          vec3 magenta=vec3(1.0,.05,.48);
          float spectrum=fract(vUv.x*1.35+vUv.y*.22);
          vec3 projected=mix(violet,blue,smoothstep(.0,.42,spectrum));
          projected=mix(projected,cyan,smoothstep(.42,.78,spectrum));
          projected=mix(projected,magenta,smoothstep(.92,1.0,spectrum));

          // Fine horizontal scanlines and a moving projection sweep.
          float scanBand=pow(max(0.0,sin(vUv.y*420.0)),18.0);
          float sweep=exp(-pow((fract(vUv.y-uTime*.055)-.5)*10.0,2.0));

          // Fragment the continent into projected digital cells.
          vec2 cell=floor(vUv*vec2(260.0,170.0));
          float cellNoise=hash21(cell);
          float broken=step(.075,cellNoise);
          float micro=step(.40,hash21(cell+17.0));
          float fragments=land*broken*(.45+.55*micro);

          // Real coastlines remain sharply visible.
          float coastLine=smoothstep(.035,.28,coast);

          float alpha=
            land*0.16+
            fragments*0.34+
            coastLine*0.78+
            scanBand*land*0.28+
            sweep*land*0.42;

          alpha*=edgeFade;

          if(alpha<.025) discard;
          gl_FragColor=vec4(projected,clamp(alpha,.0,.86));
        }
      `,
      transparent:true,
      depthWrite:false,
      blending:THREE.AdditiveBlending,
      side:THREE.FrontSide
    });

    const earth=new THREE.Mesh(
      new THREE.SphereGeometry(1,128,96),
      hologramSurface
    );
    earth.scale.setScalar(.5625);
    earthSystem.add(earth);

    // Holographic point projection: real land areas become separated luminous dots.
    const pointGeometry=new THREE.SphereGeometry(1.012,112,72);
    const pointMaterial=new THREE.ShaderMaterial({
      uniforms:{
        uMap:{value:earthTexture},
        uTime:{value:0},
        uTexel:{value:new THREE.Vector2(1/2048,1/2048)}
      },
      vertexShader:`
        varying vec2 vUv;
        varying float vFacing;
        void main(){
          vUv=uv;
          vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
          vec3 n=normalize(normalMatrix*normal);
          vFacing=smoothstep(-.15,.58,n.z);
          float pulse=.82+.18*sin(uTime*2.1+position.y*12.0+position.x*9.0);
          gl_PointSize=(2.0+2.8*pulse)*vFacing;
          gl_Position=projectionMatrix*mvPosition;
        }
      `,
      fragmentShader:`
        uniform sampler2D uMap;
        uniform float uTime;
        varying vec2 vUv;
        varying float vFacing;

        float landMask(vec3 c){
          float green=c.g-(c.b*0.78+c.r*0.10);
          float warm=(c.r+c.g)*0.42-c.b*0.52;
          float brightness=dot(c,vec3(.299,.587,.114));
          float chroma=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));
          return smoothstep(.015,.085,max(green,warm))*
                 smoothstep(.08,.62,brightness+.35*chroma);
        }

        void main(){
          vec2 p=gl_PointCoord-.5;
          float d=length(p);
          if(d>.5) discard;
          float land=landMask(texture2D(uMap,vUv).rgb);
          if(land<.22 || vFacing<.04) discard;

          float sparkle=step(.68,fract(sin(dot(vUv+uTime*.002,vec2(127.1,311.7)))*43758.5453));
          vec3 c=mix(vec3(.18,.55,1.0),vec3(.75,.18,1.0),fract(vUv.x*2.0));
          c=mix(c,vec3(1.0,.12,.48),sparkle*.35);
          float a=(1.0-smoothstep(.0,.5,d))*(.32+.32*sparkle)*vFacing;
          gl_FragColor=vec4(c,a);
        }
      `,
      transparent:true,
      depthWrite:false,
      blending:THREE.AdditiveBlending
    });
    pointMaterial.uniforms.uMap.value=earthTexture;

    const landPoints=new THREE.Points(pointGeometry,pointMaterial);
    landPoints.scale.setScalar(.5625);
    earthSystem.add(landPoints);

    // Transparent latitude/longitude projection grid: technical hologram scaffold.
    const gridMaterial=new THREE.LineBasicMaterial({
      color:0x4fa9ff,
      transparent:true,
      opacity:.16,
      blending:THREE.AdditiveBlending,
      depthWrite:false
    });
    const gridGroup=new THREE.Group();
    const gridRadius=.566;
    const gridSegments=96;

    for(let lat=-60;lat<=60;lat+=20){
      const phi=THREE.MathUtils.degToRad(lat);
      const r=Math.cos(phi)*gridRadius;
      const y=Math.sin(phi)*gridRadius;
      const pts=[];
      for(let i=0;i<=gridSegments;i++){
        const a=(i/gridSegments)*Math.PI*2;
        pts.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));
      }
      const line=new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        gridMaterial
      );
      gridGroup.add(line);
    }

    for(let lon=0;lon<360;lon+=20){
      const pts=[];
      const theta=THREE.MathUtils.degToRad(lon);
      for(let i=0;i<=72;i++){
        const t=i/72;
        const phi=-Math.PI/2+t*Math.PI;
        pts.push(new THREE.Vector3(
          Math.cos(phi)*Math.cos(theta)*gridRadius,
          Math.sin(phi)*gridRadius,
          Math.cos(phi)*Math.sin(theta)*gridRadius
        ));
      }
      const line=new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        gridMaterial
      );
      gridGroup.add(line);
    }
    earthSystem.add(gridGroup);

    // Floating hologram shell: broken equator bands instead of a physical glow.
    const shellMaterial=new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0}},
      vertexShader:`
        varying vec3 vNormal;
        void main(){
          vNormal=normalize(normalMatrix*normal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        }
      `,
      fragmentShader:`
        uniform float uTime;
        varying vec3 vNormal;
        void main(){
          float facing=pow(1.0-max(0.0,vNormal.z),2.2);
          float scan=step(.74,fract((vNormal.y+uTime*.025)*34.0));
          float a=facing*.08+scan*.035;
          if(a<.012) discard;
          vec3 c=mix(vec3(.45,.08,1.0),vec3(.05,.75,1.0),vNormal.y*.5+.5);
          gl_FragColor=vec4(c,a);
        }
      `,
      transparent:true,
      depthWrite:false,
      blending:THREE.AdditiveBlending,
      side:THREE.BackSide
    });
    const shell=new THREE.Mesh(new THREE.SphereGeometry(1.035,64,48),shellMaterial);
    shell.scale.setScalar(.5625);
    earthSystem.add(shell);

    let dragging=false;
    let lastPointer={x:0,y:0};
    const onPointerDown=(e:PointerEvent)=>{
      dragging=true;
      lastPointer={x:e.clientX,y:e.clientY};
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove=(e:PointerEvent)=>{
      if(!dragging)return;
      const dx=e.clientX-lastPointer.x;
      const dy=e.clientY-lastPointer.y;
      lastPointer={x:e.clientX,y:e.clientY};
      earthSystem.rotation.y+=dx*.006;
      earthSystem.rotation.x+=dy*.0045;
      earthSystem.rotation.x=Math.max(-1.45,Math.min(1.45,earthSystem.rotation.x));
    };
    const onPointerUp=(e:PointerEvent)=>{
      dragging=false;
      if(renderer.domElement.hasPointerCapture(e.pointerId)){
        renderer.domElement.releasePointerCapture(e.pointerId);
      }
    };
    renderer.domElement.addEventListener("pointerdown",onPointerDown);
    renderer.domElement.addEventListener("pointermove",onPointerMove);
    renderer.domElement.addEventListener("pointerup",onPointerUp);
    renderer.domElement.addEventListener("pointercancel",onPointerUp);

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
    const animate=(now:number)=>{
      const elapsed=now*.001;
      hologramSurface.uniforms.uTime.value=elapsed;
      pointMaterial.uniforms.uTime.value=elapsed;
      shellMaterial.uniforms.uTime.value=elapsed;
      renderer.render(scene,camera);
      raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);

    return()=>{
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown",onPointerDown);
      renderer.domElement.removeEventListener("pointermove",onPointerMove);
      renderer.domElement.removeEventListener("pointerup",onPointerUp);
      renderer.domElement.removeEventListener("pointercancel",onPointerUp);
      scene.traverse(o=>{
        const mesh=o as THREE.Mesh|THREE.Line|THREE.Points;
        if(mesh.geometry)mesh.geometry.dispose();
        const material=mesh.material as THREE.Material|THREE.Material[];
        if(Array.isArray(material))material.forEach(m=>m.dispose());
        else if(material)material.dispose();
      });
      earthTexture.dispose();
      renderer.dispose();
      if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);
    };
  },[]);

  return <div className="earthGlobe realEarth" ref={mountRef} aria-label="Globo holográfico 3D da Terra interativo" />;
}
function OrbitalRings(){
  const mountRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const mount=mountRef.current;
    if(!mount)return;

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,0.1,100);
    camera.position.set(0,0,6.3);

    const renderer=new THREE.WebGLRenderer({
      antialias:true,
      alpha:true,
      powerPreference:"high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000,0);
    mount.appendChild(renderer.domElement);

    const orbitalGroup=new THREE.Group();
    scene.add(orbitalGroup);

    type RingState={
      group:THREE.Group;
      markerA:THREE.Mesh;
      markerB:THREE.Mesh;
      markerC:THREE.Mesh;
      radius:number;
      axis:THREE.Vector3;
      speed:number;
      phase:number;
    };

    const ringStates:RingState[]=[];
    const makeRing=(
      radius:number,thickness:number,color:number,opacity:number,
      axis:THREE.Vector3,speed:number,phase:number,scaleX:number
    )=>{
      const group=new THREE.Group();
      const ringMaterial=new THREE.MeshBasicMaterial({
        color,transparent:true,opacity,
        blending:THREE.AdditiveBlending,depthWrite:false
      });
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(radius,thickness,6,96),
        ringMaterial
      );
      ring.scale.x=scaleX;
      group.add(ring);

      const techTrace=new THREE.Mesh(
        new THREE.TorusGeometry(radius*1.012,Math.max(.0012,thickness*.58),4,96),
        new THREE.MeshBasicMaterial({
          color,transparent:true,opacity:Math.min(1,opacity*.62),
          blending:THREE.AdditiveBlending,depthWrite:false
        })
      );
      techTrace.scale.x=scaleX;
      techTrace.rotation.z=.012;
      group.add(techTrace);

      const markerMaterial=new THREE.MeshBasicMaterial({
        color,transparent:true,opacity:Math.min(1,opacity+.25),
        blending:THREE.AdditiveBlending,depthWrite:false
      });
      const markerA=new THREE.Mesh(new THREE.SphereGeometry(.018,8,8),markerMaterial);
      const markerB=new THREE.Mesh(new THREE.SphereGeometry(.010,8,8),markerMaterial);
      const markerC=new THREE.Mesh(new THREE.SphereGeometry(.008,7,7),markerMaterial);
      group.add(markerA,markerB,markerC);
      orbitalGroup.add(group);

      ringStates.push({group,markerA,markerB,markerC,radius,axis,speed,phase});
    };

    makeRing(.714375,.0045,0x7448ff,.72,new THREE.Vector3(.3,.8,.2).normalize(),.225,.35,1.34);
    makeRing(.781875,.0025,0xff2d56,.52,new THREE.Vector3(-.6,.2,.7).normalize(),-.162,2.1,.78);
    makeRing(.855,.002,0x3e74ff,.42,new THREE.Vector3(.7,-.4,.3).normalize(),.098,4.0,1.22);
    makeRing(.945,.0015,0xb23dff,.28,new THREE.Vector3(.2,.6,-.7).normalize(),-.070,1.25,.86);

    const outerRings=new THREE.Group();
    scene.add(outerRings);
    const outerStates:{group:THREE.Group;radius:number;phase:number;speed:number}[]=[];
    for(let i=0;i<5;i++){
      const r=1.029375+i*.050625;
      const group=new THREE.Group();
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(r,.00105+(i%3)*.0005,5,80),
        new THREE.MeshBasicMaterial({
          color:i%2?0x765cff:0xff3d69,
          transparent:true,
          opacity:.19+(i%3)*.035,
          blending:THREE.AdditiveBlending,
          depthWrite:false
        })
      );
      ring.rotation.x=Math.PI/2;
      ring.scale.x=i%2?1.08:.94;
      ring.rotation.z=i*.31;
      group.add(ring);

      const techTrace=new THREE.Mesh(
        new THREE.TorusGeometry(r*1.008,.00065,4,80),
        new THREE.MeshBasicMaterial({
          color:i%2?0x9b8aff:0xff708d,
          transparent:true,
          opacity:.24,
          blending:THREE.AdditiveBlending,
          depthWrite:false
        })
      );
      techTrace.rotation.x=Math.PI/2;
      techTrace.scale.x=i%2?1.08:.94;
      techTrace.rotation.z=i*.31+.018;
      group.add(techTrace);
      const marker=new THREE.Mesh(
        new THREE.SphereGeometry(.007,6,6),
        new THREE.MeshBasicMaterial({
          color:i%2?0x9d8cff:0xff6f86,
          transparent:true,opacity:.7,
          blending:THREE.AdditiveBlending,depthWrite:false
        })
      );
      const marker2=new THREE.Mesh(
        new THREE.SphereGeometry(.0055,6,6),
        new THREE.MeshBasicMaterial({
          color:i%2?0x7d68ff:0xff5878,
          transparent:true,opacity:.62,
          blending:THREE.AdditiveBlending,depthWrite:false
        })
      );
      group.add(marker,marker2);
      outerRings.add(group);
      outerStates.push({group,radius:r,phase:i*.73,speed:(i%2?-.026:.021)*(1+i*.11)});
    }

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
    const animate=(now:number)=>{
      const elapsed=now*.001;
      const q=new THREE.Quaternion();
      const axis=new THREE.Vector3();

      q.setFromEuler(new THREE.Euler(elapsed*.021,elapsed*.055,elapsed*.0137,"XYZ"));
      orbitalGroup.quaternion.copy(q);

      ringStates.forEach((state,index)=>{
        axis.copy(state.axis);
        const angle=elapsed*state.speed+Math.sin(elapsed*(.0071+index*.0013)+state.phase)*.17;
        q.setFromAxisAngle(axis,angle);
        state.group.quaternion.copy(q);
        state.group.scale.set(
          1+Math.sin(elapsed*(.023+index*.0047)+state.phase)*.055,
          1+Math.cos(elapsed*(.017+index*.0031)+state.phase*1.7)*.035,
          1
        );

        const markerPhase=elapsed*(.31+index*.071)+state.phase;
        state.markerA.position.set(
          Math.cos(markerPhase)*state.radius,
          Math.sin(markerPhase)*state.radius,
          Math.sin(markerPhase*.73)*.08
        );
        state.markerB.position.set(
          Math.cos(markerPhase*1.37+1.4)*state.radius*.48,
          Math.sin(markerPhase*1.37+1.4)*state.radius*.48,
          Math.cos(markerPhase*.91)*.11
        );
        state.markerC.position.set(
          Math.cos(markerPhase*.83+3.2)*state.radius*.78,
          Math.sin(markerPhase*.83+3.2)*state.radius*.78,
          Math.sin(markerPhase*1.11)*.09
        );
      });

      outerStates.forEach((state,index)=>{
        const angle=elapsed*state.speed+Math.sin(elapsed*(.009+index*.0011)+state.phase)*.11;
        const wobble=1+Math.sin(elapsed*(.019+index*.0023)+state.phase)*.035;
        state.group.quaternion.setFromEuler(new THREE.Euler(
          Math.PI/2+Math.sin(elapsed*.013+index)*.08,
          angle,
          index*.31+Math.cos(elapsed*.011+index*.7)*.12,
          "XYZ"
        ));
        state.group.scale.set(wobble,1,1);
        const marker=state.group.children[1] as THREE.Mesh;
        const marker2=state.group.children[2] as THREE.Mesh;
        const markerPhase=elapsed*(.17+index*.023)+state.phase;
        marker.position.set(
          Math.cos(markerPhase)*state.radius,
          Math.sin(markerPhase)*state.radius,
          Math.sin(markerPhase*.67)*.05
        );
        marker2.position.set(
          Math.cos(markerPhase*1.31+2.2)*state.radius,
          Math.sin(markerPhase*1.31+2.2)*state.radius,
          Math.cos(markerPhase*.81)*.07
        );
      });

      renderer.render(scene,camera);
      raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);

    return()=>{
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      scene.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(mesh.geometry)mesh.geometry.dispose();
        const material=mesh.material as THREE.Material|THREE.Material[];
        if(Array.isArray(material))material.forEach(m=>m.dispose());
        else if(material)material.dispose();
      });
      renderer.dispose();
      if(renderer.domElement.parentElement===mount)mount.removeChild(renderer.domElement);
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
