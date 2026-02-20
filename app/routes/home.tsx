import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment, Center } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "../app.css";

function HeartModel({ isShaking }: { isShaking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { scene, animations } = useGLTF("/heart.glb");
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (actions["Action"]) actions["Action"].play();
    scene.traverse((obj: any) => {
      if (obj.isMesh && obj.material.name === "jelly") {
        obj.material.emissiveIntensity = 10;
        obj.material.emissive.set("#ad1313");
      }
    });
  }, [actions, scene]);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y += 0.005;
    if (isShaking) {
      group.current.position.x = (Math.random() - 0.5) * 0.03;
      group.current.position.y = (Math.random() - 0.5) * 0.03;
    } else {
      group.current.position.set(0, 0, 0);
    }
    scene.traverse((obj: any) => {
      if (obj.isMesh && obj.material.name === "jelly") {
        const targetIntensity = isShaking ? 35 : hovered ? 20 : 10;
        obj.material.emissiveIntensity = THREE.MathUtils.lerp(
          obj.material.emissiveIntensity,
          targetIntensity,
          0.1,
        );
      }
    });
  });

  return (
    <group ref={group}>
      <primitive
        object={scene}
        scale={hovered ? 0.22 : 0.2}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      />
    </group>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const isFirstLoad = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedPseudo = localStorage.getItem("user-pseudo");
    if (savedPseudo) setPseudo(savedPseudo);

    const q = query(
      collection(db, "messages"),
      orderBy("createdAt", "desc"),
      limit(10),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        time:
          doc
            .data()
            .createdAt?.toDate()
            ?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ||
          "...",
      }));

      const chronological = docs.reverse(); 
      setMessages(chronological);

      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        return;
      }
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 800);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim() || !text.trim()) return;

    try {
      localStorage.setItem("user-pseudo", pseudo);
      await addDoc(collection(db, "messages"), {
        text,
        author: pseudo,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (error) {
      console.error("Erreur Firestore :", error);
    }
  };

  const latestMsg = messages[messages.length - 1];

  return (
    <div className="home-container">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <color attach="background" args={["#050505"]} />
        <ambientLight intensity={0.5} />
        <Environment preset="night" />
        <Center>
          <HeartModel isShaking={isShaking} />
        </Center>
        <EffectComposer>
          <Bloom
            intensity={1.5}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      <div className="thread-container" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className="thread-item">
            <p className="thread-text">
              {msg.text}
              <br />
              <span className="thread-author">- {msg.author}</span>
            </p>
            <span className="thread-time">{msg.time}</span>
          </div>
        ))}
      </div>

      <div className="ui-overlay">
        <form onSubmit={handleSubmit} className="message-form">
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Nom"
            className="pseudo-input"
            maxLength={15}
            required
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ton message..."
            className="message-input"
            required
          />
          <button type="submit" style={{ display: "none" }}>Envoyer</button>
        </form>
      </div>

      {latestMsg && (
        <div className="bottom-overlay">
          <span className="message-author">
            {latestMsg.author} — {latestMsg.time}
          </span>
          <h1 className="message-title">
            <span className="message-highlight">{latestMsg.text}</span>
          </h1>
        </div>
      )}
    </div>
  );
}