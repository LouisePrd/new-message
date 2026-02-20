import { useState, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment, Center } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "../app.css";

function HeartModel() {
  const group = useRef<any>(null);
  const { scene, animations } = useGLTF("/heart.glb");
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (actions["Action"]) actions["Action"].play();

    scene.traverse((obj: any) => {
      if (obj.isMesh && obj.material.name === "jelly") {
        obj.material.emissiveIntensity = 12; 
        obj.material.emissive.set("#ad1313"); 
      }
    });
  }, [actions, scene]);

  useFrame(() => {
    if (group.current) group.current.rotation.y += 0.005;
  });

  return <primitive ref={group} object={scene} scale={0.2} />;
}

export default function Home() {
  const [text, setText] = useState("");
  const [lastMessage, setLastMessage] = useState<{text: string, date: string} | null>(null);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(q, (snapshot) => {
      const doc = snapshot.docs[0];
      if (doc) {
        const data = doc.data();
        const dateObj = data.createdAt?.toDate(); 
        const formattedDate = dateObj 
          ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : "À l'instant";

        setLastMessage({
          text: data.text,
          date: formattedDate
        });
      }
    });
  }, []);

  // Requête d'écriture via addDoc 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(collection(db, "messages"), {
      text,
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  return (
    <div className="home-container">
      {/* Interface Haut : Input */}
      <div className="ui-overlay">
        <form onSubmit={handleSubmit} className="message-form">
          <input 
            value={text} 
            onChange={(e) => setText(e.target.value)}
            placeholder="Écris ton message..."
            className="message-input"
          />
        </form>
      </div>

      {/* Rendu 3D */}
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <color attach="background" args={["#050505"]} />
        <ambientLight intensity={0.5} />
        <Environment preset="night" /> 

        <Center>
          <HeartModel />
        </Center>

        <EffectComposer>
          <Bloom 
            intensity={1.2} 
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9} 
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {lastMessage && (
        <div className="bottom-overlay">
          <p className="message-date">{lastMessage.date}</p>
          <h1 className="message-title">
            <span className="message-highlight">{lastMessage.text}</span>
          </h1>
        </div>
      )}
    </div>
  );
}