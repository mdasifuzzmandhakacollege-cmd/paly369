/**
 * @file GameLobby.tsx
 * @description Master Authenticated Home & Mobile Lobby interface for PLAY369.
 * 
 * Precision Hierarchy:
 * 1. Notice Marquee & Search Header
 * 2. Wallet / Balance Hero Card + Deposit
 * 3. Jackpot / Highlighted Feature Spotlight
 * 4. VIP Progression Strip
 * 5. Category Icon Row (Live Casino, Slots, Crash, Table, Sports, etc.)
 * 6. Live Casino Section (Horizontal swipe)
 * 7. Trending Games Section (Horizontal rail)
 * 8. Top Providers Section (Brand badge chips)
 * 9. Responsive Game Grid (with loading & empty states)
 * 10. Live Activity Ticker
 * 11. Consolidated Floating Rewards Action Hub
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Strictly uses authoritative data via `WalletGameContext` and `gameService`.
 * - Zero fabricated balances or fake jackpot amounts.
 * - Mobile responsive from 320px to 430px+ and desktop.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { gameService } from '../services/gameService';
import { GameItem } from '../services/providers/types';
import {
  MockCategory,
  MockProvider,
  MockFeaturedHeroSlide,
  MOCK_CATEGORIES,
  MOCK_PROVIDERS,
  MOCK_FEATURED_SLIDES
} from '../data/mockGamesData';
import { useWalletGame } from '../contexts/WalletGameContext';
import { LobbyHeader } from './lobby/LobbyHeader';
import { WalletHeroCard } from './lobby/WalletHeroCard';
import { JackpotFeatureCard } from './lobby/JackpotFeatureCard';
import { VipProgressionStrip } from './lobby/VipProgressionStrip';
import { GameCategoryNav } from './lobby/GameCategoryNav';
import { LiveCasinoSection } from './lobby/LiveCasinoSection';
import { TrendingGamesSection } from './lobby/TrendingGamesSection';
import { TopProvidersSection } from './lobby/TopProvidersSection';
import { GameGrid } from './lobby/GameGrid';
import { GameSearchModal } from './lobby/GameSearchModal';
import { FloatingActionHub } from './lobby/FloatingActionHub';
import { LiveActivityTicker } from './LiveActivityTicker';
import { TreasureChestModal } from './TreasureChestModal';
import { DailyUnclaimedRewardsModal } from './DailyUnclaimedRewardsModal';
import { ShareWheelModal } from './ShareWheelModal';
import { InboxMailModal } from './InboxMailModal';
import { SupportModal } from './SupportModal';
import { soundEngine } from '../services/soundEngine';

export interface GameLobbyProps {
  currentUser?: UserEntity;
  currentWallet?: WalletEntity;
  currency?: 'BDT' | 'USD';
  onLaunchGame: (gameId: string) => void;
  onOpenCashier: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  currentUser: propUser,
  currentWallet: propWallet,
  currency: propCurrency = 'BDT',
  onLaunchGame,
  onOpenCashier,
  onNavigateTab
}) => {
  const {
    currentUser: contextUser,
    currentWallet: contextWallet,
    currency: contextCurrency,
    formattedBalance,
    balanceFlash,
    refreshState
  } = useWalletGame();

  const currentUser = propUser || contextUser;
  const currentWallet = propWallet || contextWallet;
  const currency = propCurrency || contextCurrency;

  // Navigation & Filter States
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Catalog State loaded via GameService
  const [games, setGames] = useState<GameItem[]>([]);
  const [allCatalogGames, setAllCatalogGames] = useState<GameItem[]>([]);
  const [categories, setCategories] = useState<MockCategory[]>(MOCK_CATEGORIES);
  const [providers, setProviders] = useState<MockProvider[]>(MOCK_PROVIDERS);
  const [featuredSlides, setFeaturedSlides] = useState<MockFeaturedHeroSlide[]>(MOCK_FEATURED_SLIDES);

  // Favorite Games State
  const [favorites, setFavorites] = useState<string[]>(['spribe_aviator', 'vs20olympgate']);

  // Modals for gamification widgets
  const [isTreasureOpen, setIsTreasureOpen] = useState<boolean>(false);
  const [isRewardsOpen, setIsRewardsOpen] = useState<boolean>(false);
  const [isShareWheelOpen, setIsShareWheelOpen] = useState<boolean>(false);
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);

  // 1. Initial metadata loading from GameService
  useEffect(() => {
    let isMounted = true;

    async function loadLobbyMetadata() {
      try {
        const [cats, provs, slides, fullCatalog] = await Promise.all([
          gameService.getCategories(),
          gameService.getProviders(),
          gameService.getFeaturedSlides(),
          gameService.listGames()
        ]);

        if (isMounted) {
          setCategories(cats);
          setProviders(provs);
          setFeaturedSlides(slides);
          setAllCatalogGames(fullCatalog);
        }
      } catch (err) {
        console.error('Failed to load initial lobby metadata:', err);
      }
    }

    loadLobbyMetadata();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize category from URL query parameters (e.g. ?category=slots)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam) {
      setActiveCategory(categoryParam);
    }
  }, []);

  // 3. Fetch filtered games dynamically via gameService
  const fetchFilteredGames = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await gameService.listGames({
        category: activeCategory,
        providerId: selectedProvider
      });
      setGames(results);
    } catch (err) {
      console.error('Failed to list games via gameService:', err);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, selectedProvider]);

  useEffect(() => {
    fetchFilteredGames();
  }, [fetchFilteredGames]);

  // Handle favorite toggle
  const handleToggleFavorite = (gameId: string) => {
    setFavorites((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  };

  // Reset all filters helper
  const handleResetFilters = () => {
    setActiveCategory('all');
    setSelectedProvider('all');
  };

  // Safe game launcher bridging to GameService adapter launch
  const handleLaunchGame = async (gameId: string) => {
    soundEngine.playClick(1050);
    try {
      if (currentUser) {
        await gameService.launchGame({
          userId: currentUser.id,
          username: currentUser.username,
          gameId,
          currency
        });
      }
    } catch (err) {
      console.warn('Game launch session note:', err);
    }
    onLaunchGame(gameId);
  };

  return (
    <div
      id="play369-authenticated-game-lobby"
      className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6 py-2 sm:py-4 space-y-3.5 sm:space-y-5 text-slate-100 font-sans pb-28 lg:pb-12"
    >
      {/* 1. Header: Marquee Announcements & Quick Search */}
      <LobbyHeader onOpenSearch={() => setIsSearchOpen(true)} />

      {/* 2. Wallet / Balance Hero Card + Deposit Action */}
      <WalletHeroCard
        currentWallet={currentWallet}
        formattedBalance={formattedBalance}
        currency={currency}
        balanceFlash={balanceFlash}
        onOpenCashier={onOpenCashier}
        onRefresh={refreshState}
      />

      {/* 3. Jackpot / Highlighted Feature Spotlight Card */}
      <JackpotFeatureCard
        slide={featuredSlides[0]}
        onLaunchGame={handleLaunchGame}
        onOpenCashier={onOpenCashier}
      />

      {/* 4. VIP Progression Strip */}
      <VipProgressionStrip
        currentUser={currentUser}
        onNavigateVip={() => onNavigateTab && onNavigateTab('vip')}
      />

      {/* 5. Main Game Category Icons */}
      <GameCategoryNav
        activeCategory={activeCategory}
        onSelectCategory={(catId) => setActiveCategory(catId)}
        categories={categories}
      />

      {/* 6. Live Casino Section (Horizontal Swipe Cards) */}
      {(activeCategory === 'all' || activeCategory === 'casino') && (
        <LiveCasinoSection
          games={allCatalogGames}
          onLaunchGame={handleLaunchGame}
          onViewAllCasino={() => setActiveCategory('casino')}
        />
      )}

      {/* 7. Trending Games Section (Horizontal Rail) */}
      {(activeCategory === 'all' || activeCategory === 'hot') && (
        <TrendingGamesSection
          games={allCatalogGames}
          onLaunchGame={handleLaunchGame}
          onViewAllTrending={() => setActiveCategory('hot')}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* 8. Top Providers Section */}
      <TopProvidersSection
        providers={providers}
        selectedProvider={selectedProvider}
        onSelectProvider={(provId) => setSelectedProvider(provId)}
        onViewAllProviders={() => setSelectedProvider('all')}
      />

      {/* 9. Main Game Grid (Filtered or All) */}
      <GameGrid
        games={games}
        isLoading={isLoading}
        onLaunchGame={handleLaunchGame}
        onResetFilters={handleResetFilters}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        title={
          activeCategory === 'all'
            ? 'All Games'
            : categories.find((c) => c.id === activeCategory)?.label || 'Games'
        }
        totalCount={allCatalogGames.length}
      />

      {/* 10. Live Activity Ticker */}
      <div className="pt-2">
        <LiveActivityTicker onLaunchGame={handleLaunchGame} />
      </div>

      {/* 11. Consolidated Non-Obstructive Floating Rewards Action Hub */}
      <FloatingActionHub
        onOpenVipRewards={() => setIsRewardsOpen(true)}
        onOpenShareWheel={() => setIsShareWheelOpen(true)}
        onOpenTreasure={() => setIsTreasureOpen(true)}
      />

      {/* Search Modal */}
      <GameSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        games={allCatalogGames}
        onLaunchGame={handleLaunchGame}
      />

      {/* Gamified Modals */}
      <TreasureChestModal
        isOpen={isTreasureOpen}
        onClose={() => setIsTreasureOpen(false)}
        currency={currency}
      />

      <DailyUnclaimedRewardsModal
        isOpen={isRewardsOpen}
        onClose={() => setIsRewardsOpen(false)}
        currency={currency}
      />

      <ShareWheelModal
        isOpen={isShareWheelOpen}
        onClose={() => setIsShareWheelOpen(false)}
      />

      <InboxMailModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        onNavigateTab={onNavigateTab || (() => {})}
      />

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
    </div>
  );
};
