import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Mail, Lock, Eye, EyeOff, Hash, Info, ArrowLeft, Key } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function StaffActivation() {
  const [showPassword, setShowPassword] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    setIsLoading(true);

    try {
      const settingsDoc = await getDoc(doc(db, "settings", "auth"));
      
      if (!settingsDoc.exists() || !settingsDoc.data().staffAccessCode) {
        throw new Error("Activation system is currently unavailable. Please contact an administrator.");
      }

      if (accessCode !== settingsDoc.data().staffAccessCode) {
        throw new Error("Invalid access code.");
      }

      const staffQuery = query(
        collection(db, "pre_registered_staff"), 
        where("email", "==", email.toLowerCase()),
        where("employeeId", "==", employeeId)
      );
      
      const querySnapshot = await getDocs(staffQuery);

      if (querySnapshot.empty) {
        throw new Error("Could not find a pre-registered employee with that email and ID combination.");
      }

      const preRegData = querySnapshot.docs[0].data();
      const staffName =
        preRegData.displayName ||
        preRegData.fullName ||
        preRegData.name ||
        [preRegData.firstName, preRegData.lastName].filter(Boolean).join(' ').trim() ||
        '';

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      if (staffName) {
        try {
          await updateProfile(userCredential.user, { displayName: staffName });
        } catch {
          // Non-blocking
        }
      }
      
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: email.toLowerCase(),
        ...(staffName ? { fullName: staffName, displayName: staffName } : {}),
        employeeId,
        role: 'staff',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });

      const actionCodeSettings = {
        url: `${window.location.origin}/auth/login`,
        handleCodeInApp: false
      };
      await sendEmailVerification(userCredential.user, actionCodeSettings);
      await auth.signOut();

      navigate('/auth/verify-email', { state: { email, password } });
    } catch (err: any) {
      showToast(err.message || "Failed to activate account.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 text-center relative">
        <Link to="/auth/signup" className="absolute left-0 top-1/2 -translate-y-1/2 text-soft-gray hover:text-white transition-colors p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold font-display tracking-tight mb-2 text-white">Activate Account</h1>
      </div>

      <div className="bg-burnt-orange/10 border border-burnt-orange/30 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-[0_0_15px_rgba(232,106,51,0.1)]">
        <Info className="w-5 h-5 text-burnt-orange shrink-0 mt-0.5" />
        <p className="text-xs text-white/90 leading-relaxed font-medium">
          Your employee profile must be pre-registered by a WashWizzy administrator before activation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input 
          label="Employee ID"
          type="text"
          placeholder="e.g. EMP-1234"
          icon={<Hash className="w-5 h-5" />}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          required
        />

        <Input 
          label="Work Email"
          type="email"
          placeholder="Enter registered email"
          icon={<Mail className="w-5 h-5" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input 
          label="Access Code"
          type="text"
          placeholder="Enter access code"
          icon={<Key className="w-5 h-5" />}
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          required
        />
        
        <div className="space-y-1">
          <div className="relative">
            <Input 
              label="New Password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              icon={<Lock className="w-5 h-5" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-[38px] text-soft-gray hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="relative pt-1">
          <Input 
            label="Confirm Password"
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            icon={<Lock className="w-5 h-5" />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-[42px] text-soft-gray hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <Button type="submit" fullWidth isLoading={isLoading} className="mt-6">
          Activate Account
        </Button>
      </form>

      <p className="mt-8 text-center text-soft-gray text-sm">
        Already activated?{' '}
        <Link to="/auth/login" className="text-burnt-orange font-semibold hover:underline transition-all">
          Sign In
        </Link>
      </p>
    </div>
  );
}
