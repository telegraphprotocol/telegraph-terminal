"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Shield, Globe, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0510] selection:bg-primary/30">
      {/* Background Ambient Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ 
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,1) 1px, transparent 0)`,
            backgroundSize: '40px 40px' 
          }} 
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-6 py-12 flex flex-col items-center text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-[11px] font-bold uppercase tracking-[0.2em] mb-8"
        >
          <Zap size={12} />
          Now Live: Neural Gateway v1.4
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-8xl font-black tracking-tight text-white mb-6"
        >
          Telegraph <br />
          <span className="text-gradient-premium">Intelligence</span> Terminal
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed mb-12"
        >
          The decentralized command center for next-generation AI agents. 
          Analyze subnets, settle transactions, and verify proof-of-compute 
          across the neural web in real-time.
        </motion.p>

        {/* Call to Actions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 mb-20"
        >
          <Link
            href="/demo"
            className="group relative flex items-center justify-center gap-2 h-14 px-10 rounded-2xl bg-gradient-premium text-white font-bold transition-all hover:scale-105 hover:shadow-[0_0_40px_-5px_rgba(140,89,255,0.6)] active:scale-95"
          >
            Launch Terminal
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          
          <Link
            href="/live"
            className="flex items-center justify-center gap-2 h-14 px-10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-white font-bold transition-all hover:bg-white/10 active:scale-95"
          >
            Go Live
            <Globe size={18} className="opacity-60" />
          </Link>
        </motion.div>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full"
        >
          {[
            { 
              icon: Zap, 
              title: "Millisecond Settlement", 
              desc: "On-chain verification for every AI inference across top subnets." 
            },
            { 
              icon: Shield, 
              title: "Verified Intelligence", 
              desc: "Zero-knowledge proofs ensure the authenticity of every generated signal." 
            },
            { 
              icon: Globe, 
              title: "Multi-Subnet Routing", 
              desc: "Intelligent request dispatching to the most optimized neural providers." 
            }
          ].map((feature, i) => (
            <div 
              key={i} 
              className="group p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-sm text-left hover:bg-white/[0.04] transition-all duration-500"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                <feature.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
      
      {/* Footer link */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 text-[10px] text-white font-bold uppercase tracking-[0.4em]"
      >
        Built by Telegraph Protocol
      </motion.div>
    </main>
  );
}
