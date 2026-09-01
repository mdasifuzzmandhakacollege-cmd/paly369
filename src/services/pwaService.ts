/**
 * @file pwaService.ts
 * @description PWA installation and Service Worker registration manager for Playall 365.
 * Captures the 'beforeinstallprompt' event to trigger native browser install prompts
 * or show interactive step-by-step guides for iOS/Android Safari & Chrome.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

class PWAService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled: boolean = false;
  private listeners: Array<(canInstall: boolean, isInstalled: boolean) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkInstalled();
      this.initEventListeners();
      this.registerServiceWorker();
    }
  }

  public registerServiceWorker(): void {
    const isTest = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
    if ('serviceWorker' in navigator && !isTest) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('Playall 365 ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('Playall 365 ServiceWorker registration fallback:', err);
          });
      });
    }
  }

  private checkInstalled(): void {
    // Check if app is running in standalone mode (iOS or Android)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    this.isInstalled = isStandaloneMode;
  }

  private initEventListeners(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notifyListeners();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notifyListeners();
      console.log('Playall 365 PWA successfully installed!');
    });
  }

  public subscribe(callback: (canInstall: boolean, isInstalled: boolean) => void): () => void {
    this.listeners.push(callback);
    callback(this.canInstall(), this.isInstalled);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public canInstall(): boolean {
    return !!this.deferredPrompt || (!this.isInstalled && this.isIOS());
  }

  public hasPrompt(): boolean {
    return !!this.deferredPrompt;
  }

  public getIsInstalled(): boolean {
    return this.isInstalled;
  }

  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  }

  public isAndroid(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android/.test(window.navigator.userAgent);
  }

  /**
   * Triggers the native browser PWA install prompt in real-time
   */
  public async promptInstall(): Promise<'accepted' | 'dismissed' | 'manual_ios' | 'unavailable'> {
    if (this.deferredPrompt) {
      try {
        await this.deferredPrompt.prompt();
        const choiceResult = await this.deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          this.isInstalled = true;
          this.deferredPrompt = null;
          this.notifyListeners();
        }
        return choiceResult.outcome;
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
    }

    if (this.isIOS()) {
      return 'manual_ios';
    }

    return 'unavailable';
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.canInstall(), this.isInstalled));
  }
}

export const pwaService = new PWAService();
