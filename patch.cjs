const fs = require('fs');
let content = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');

// Add Star icon to lucide-react imports
content = content.replace(/ChevronDown\n\} from 'lucide-react';/, "ChevronDown,\n  Star\n} from 'lucide-react';");

// Add OTP translations
content = content.replace(/googleSignIn: 'Sign in with Google'\n  \},/g, "googleSignIn: 'Sign in with Google',\n    otp: 'OTP Verification',\n    sendOtp: 'Send OTP',\n    verifyOtp: 'Verify',\n    otpSent: 'OTP Sent!',\n    mobileNumberVerified: 'Verified'\n  },");
content = content.replace(/googleSignIn: 'গুগল দিয়ে লগইন করুন'\n  \}\n\};/g, "googleSignIn: 'গুগল দিয়ে লগইন করুন',\n    otp: 'ওটিপি ভেরিফিকেশন',\n    sendOtp: 'ওটিপি পাঠান',\n    verifyOtp: 'ভেরিফাই',\n    otpSent: 'ওটিপি পাঠানো হয়েছে!',\n    mobileNumberVerified: 'ভেরিফাইড'\n  }\n};");

// Add logo component
const logoComponent = `
const PlayallLogo = () => (
  <div className="flex flex-col items-center justify-center mb-6 mt-4 relative scale-110">
    <div className="relative flex items-center justify-center">
      {/* Circle Background */}
      <div className="absolute w-[120px] h-[120px] border-2 border-amber-500 rounded-full opacity-20 shadow-[0_0_15px_rgba(245,158,11,0.3)]"></div>
      
      {/* Playall 365 Text */}
      <div className="flex flex-col items-center z-10 relative mt-2">
        <div className="flex items-baseline space-x-0.5">
          <span className="text-4xl font-black text-white italic tracking-tighter drop-shadow-lg">Play</span>
          <span className="text-4xl font-black text-amber-500 italic tracking-tighter drop-shadow-lg">all</span>
        </div>
        <div className="flex items-center space-x-2 -mt-1 relative right-[-10px]">
           <div className="h-0.5 w-10 bg-green-500 rounded-full skew-x-12 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
           <span className="text-2xl font-black text-green-500 italic tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">365</span>
        </div>
        
        {/* Stars */}
        <div className="flex items-center space-x-1 mt-2">
           <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
           <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
           <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        </div>
      </div>
      
      {/* Bat and Ball Element (Stylized) */}
      <div className="absolute -right-6 -top-2 flex items-center rotate-[-15deg]">
         <div className="h-1.5 w-12 bg-gradient-to-l from-amber-500 to-transparent rounded-full blur-[1px]"></div>
         <div className="w-5 h-5 bg-gradient-to-br from-red-500 to-red-800 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.9)] border border-red-300 z-20 flex items-center justify-center">
            <div className="w-full h-px bg-white/40 rotate-45"></div>
            <div className="w-full h-px bg-white/40 -rotate-45 absolute"></div>
         </div>
      </div>
    </div>
  </div>
);
`;

content = content.replace("export const AuthModal: React.FC<AuthModalProps>", logoComponent + "\nexport const AuthModal: React.FC<AuthModalProps>");

// Add OTP states
content = content.replace("const [isLegalAccepted, setIsLegalAccepted] = useState(false);", "const [isLegalAccepted, setIsLegalAccepted] = useState(false);\n  const [otp, setOtp] = useState('');\n  const [isOtpSent, setIsOtpSent] = useState(false);\n  const [isOtpVerified, setIsOtpVerified] = useState(false);");

// Inject PlayallLogo into render
content = content.replace("{/* Animated Tab Switcher */}", "<PlayallLogo />\n          {/* Animated Tab Switcher */}");

fs.writeFileSync('src/components/AuthModal.tsx', content);
