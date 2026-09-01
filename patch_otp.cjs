const fs = require('fs');
let content = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');

const mobileSection = `
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">{lang.mobileNumber}</label>
                      <div className={\`relative flex items-center border \${mobileNumber.length > 0 ? (isMobileValid ? 'border-green-500/50' : 'border-gray-800') : 'border-gray-800'} bg-gray-900/50 rounded-xl overflow-hidden transition-colors\`}>
                        <div className="pl-3 pr-2 py-3 text-gray-500">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input 
                          type="tel"
                          required
                          value={mobileNumber}
                          disabled={isOtpVerified}
                          onChange={(e) => setMobileNumber(e.target.value.replace(/\\D/g, ''))}
                          placeholder={currency === 'BDT' ? "017XXXXXXXX" : "+1 (XXX)"}
                          className="w-full bg-transparent min-h-[48px] text-white focus:outline-none placeholder-gray-600 text-sm font-mono"
                        />
                        {isMobileValid && !isOtpVerified && (
                          <button
                            type="button"
                            disabled={isOtpSent}
                            onClick={() => {
                              soundEngine.playClick(600);
                              setIsOtpSent(true);
                              setTimeout(() => soundEngine.playWinChime(), 500);
                            }}
                            className={\`px-3 py-1 mr-2 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap \${isOtpSent ? 'bg-gray-800 text-green-400' : 'bg-amber-500 text-black hover:bg-amber-400'}\`}
                          >
                            {isOtpSent ? lang.otpSent : lang.sendOtp}
                          </button>
                        )}
                        {isOtpVerified && (
                          <div className="px-3 py-1 mr-2 rounded-lg bg-green-500/20 text-green-400 text-[10px] font-bold uppercase whitespace-nowrap flex items-center space-x-1">
                             <CheckCircle2 className="w-3 h-3" />
                             <span>{lang.mobileNumberVerified}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* OTP Field */}
                  <AnimatePresence>
                    {isOtpSent && !isOtpVerified && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: '12px' }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="space-y-1"
                      >
                        <label className="text-xs font-semibold text-amber-500 ml-1 uppercase tracking-wider">{lang.otp}</label>
                        <div className="relative flex items-center border border-amber-500/30 bg-amber-500/5 rounded-xl overflow-hidden">
                          <div className="pl-4 pr-3 py-3 text-amber-500/70">
                            <Lock className="w-5 h-5" />
                          </div>
                          <input 
                            type="text" 
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\\D/g, ''))}
                            placeholder="XXXX"
                            maxLength={4}
                            className="w-full bg-transparent min-h-[48px] text-amber-50 focus:outline-none placeholder-amber-500/30 text-lg font-mono tracking-[0.5em]"
                          />
                          {otp.length === 4 && (
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playClick(800);
                                setIsOtpVerified(true);
                                setIsOtpSent(false); // Hide OTP field after verify
                              }}
                              className="mr-2 px-4 py-1.5 bg-green-500 text-black rounded-lg text-xs font-bold shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                            >
                              {lang.verifyOtp}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
`;

content = content.replace(/<div className="col-span-2 space-y-1">[\s\S]*?<\/div>\n                  <\/div>/, mobileSection);
fs.writeFileSync('src/components/AuthModal.tsx', content);
