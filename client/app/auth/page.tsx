'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, Loader2, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthStep = 'email' | 'otp' | 'profile';

export default function AuthPage() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth', { email });
      const data = await response.json();
      
      if (data.requiresOTP) {
        setStep('otp');
        setCountdown(60);
        toast.success(data.emailSent 
          ? 'OTP sent to your email!' 
          : 'OTP generated (check server console)');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/otp/verify', { email, otp });
      const data = await response.json();

      if (data.accessToken && data.refreshToken) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        if (data.isComplete) {
          toast.success('Welcome back!');
          router.push('/dashboard');
        } else {
          router.push('/dashboard/complete-profile');
        }
        return;
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/complete-profile', { name });
      
      toast.success('Profile completed!');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setOtp('');
    await handleSendOTP({ preventDefault: () => {} } as React.FormEvent);
  };

  const handleBack = () => {
    setStep('email');
    setOtp('');
    setName('');
  };

  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 h-full w-full rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600"
          >
            <Shield className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white">K8s Platform</h1>
          <p className="mt-2 text-gray-400">Sign in or create an account</p>
        </div>

        <Card className="border-gray-800 bg-gray-900/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            <AnimatePresence mode="wait">
              {step === 'email' && (
                <motion.div key="email" {...stepVariants}>
                  <CardTitle className="text-xl text-white">Enter your email</CardTitle>
                  <CardDescription className="text-gray-400">
                    We&apos;ll send you a verification code
                  </CardDescription>
                </motion.div>
              )}
              {step === 'otp' && (
                <motion.div key="otp" {...stepVariants}>
                  <CardTitle className="text-xl text-white">Check your email</CardTitle>
                  <CardDescription className="text-gray-400">
                    Enter the 6-digit code sent to {email}
                  </CardDescription>
                </motion.div>
              )}
              {step === 'profile' && (
                <motion.div key="profile" {...stepVariants}>
                  <CardTitle className="text-xl text-white">Complete your profile</CardTitle>
                  <CardDescription className="text-gray-400">
                    Tell us your name to get started
                  </CardDescription>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {step === 'email' && (
                <motion.form
                  key="email-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSendOTP}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="border-gray-700 bg-gray-800 pl-10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.form>
              )}

              {step === 'otp' && (
                <motion.form
                  key="otp-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleVerifyOTP}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-gray-300">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="border-gray-700 bg-gray-800 text-center text-2xl tracking-widest font-mono text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading || otp.length !== 6}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                  <div className="text-center text-sm">
                    {countdown > 0 ? (
                      <span className="text-gray-500">Resend in {countdown}s</span>
                    ) : (
                      <button type="button" onClick={handleResendOTP} className="text-blue-500 hover:underline">
                        Resend code
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-full text-center text-sm text-gray-500 hover:text-gray-400"
                  >
                    Use a different email
                  </button>
                </motion.form>
              )}

              {step === 'profile' && (
                <motion.form
                  key="profile-form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleCompleteProfile}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading || !name.trim()}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Complete Profile'
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="w-full text-center text-sm text-gray-500 hover:text-gray-400"
                  >
                    Go back
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-6 text-center text-xs text-gray-500">
              <p>OTP expires in 5 minutes</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
