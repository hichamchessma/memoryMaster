import React from 'react';
import type { CardStateLike, ShowTimePayload, SocketLike, TableDataLike } from '../types';

type UseShowTimeHandlersParams = {
  socket: SocketLike | null;
  tableData: TableDataLike | null;
  timerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  beforeRoundTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setBombomDeclaredBy: React.Dispatch<React.SetStateAction<null | 'player1' | 'player2'>>;
  setShowShowTimePrompt: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayer1Cards: React.Dispatch<React.SetStateAction<CardStateLike[]>>;
  setPlayer2Cards: React.Dispatch<React.SetStateAction<CardStateLike[]>>;
  setQuickDiscardFlash: React.Dispatch<React.SetStateAction<string | null>>;
  setWinner: React.Dispatch<React.SetStateAction<null | 'player1' | 'player2'>>;
  setShowVictory: React.Dispatch<React.SetStateAction<boolean>>;
  setScores: React.Dispatch<React.SetStateAction<{ player1: number; player2: number }>>;
  setShowScoreboard: React.Dispatch<React.SetStateAction<boolean>>;
  getCardScore: (value: number) => number;
};

export function useShowTimeHandlers(params: UseShowTimeHandlersParams) {
  const {
    socket,
    tableData,
    timerRef,
    beforeRoundTimerRef,
    setBombomDeclaredBy,
    setShowShowTimePrompt,
    setPlayer1Cards,
    setPlayer2Cards,
    setQuickDiscardFlash,
    setWinner,
    setShowVictory,
    setScores,
    setShowScoreboard,
    getCardScore,
  } = params;

  // Déclenche ShowTime: révèle toutes les cartes, calcule le gagnant, affiche et enregistre les scores
  const triggerShowTime = React.useCallback(async () => {
    console.log('🍬 Déclenchement de ShowTime!');
    
    // Arrêter TOUS les timers (locaux et serveur)
    if (timerRef.current) {
      console.log('⏹️ Arrêt du timer local de jeu');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (beforeRoundTimerRef.current) {
      console.log('⏹️ Arrêt du timer local de mémorisation');
      clearInterval(beforeRoundTimerRef.current);
      beforeRoundTimerRef.current = null;
    }
    
    // Informer le serveur d'arrêter les timers
    if (socket && tableData?.tableId) {
      console.log('💬 Demande au serveur d\'arrêter les timers');
      socket.emit('game:stop_timers', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId
      });
      
      // Informer le serveur de déclencher le ShowTime pour tous les joueurs
      console.log('🍬 Émission de game:trigger_showtime au serveur');
      socket.emit('game:trigger_showtime', {
        tableId: tableData.tableId,
        userId: tableData.currentUserId
      });
    }
    
    // Nettoyer état Bombom
    setBombomDeclaredBy(null);
    setShowShowTimePrompt(false);
  }, [socket, tableData]);

  // Gestionnaire pour l'événement game:showtime (envoyé par le serveur à tous les joueurs)
  const handleShowTime = React.useCallback(async (data: ShowTimePayload) => {
    console.log('🍬 ShowTime event received:', data);
    const { player1Cards: p1Cards, player2Cards: p2Cards, player1Id } = data;
    
    // Déterminer si je suis player1 ou player2 dans la partie
    const myUserId = tableData?.currentUserId;
    const iAmPlayer1 = myUserId === player1Id;
    
    // IMPORTANT: Chaque joueur doit toujours voir ses propres cartes en bas (player2)
    // et les cartes adverses en haut (player1), même après le ShowTime
    if (iAmPlayer1) {
      // Si je suis player1, mes cartes sont p1Cards et doivent être affichées en bas (player2)
      console.log('🍬 Je suis player1, mes cartes sont affichées en bas');
      setPlayer2Cards(p1Cards.map((c) => ({ ...c, isFlipped: true })));
      setPlayer1Cards(p2Cards.map((c) => ({ ...c, isFlipped: true })));
    } else {
      // Si je suis player2, mes cartes sont p2Cards et doivent être affichées en bas (player2)
      console.log('🍬 Je suis player2, mes cartes sont affichées en bas');
      setPlayer1Cards(p1Cards.map((c) => ({ ...c, isFlipped: true })));
      setPlayer2Cards(p2Cards.map((c) => ({ ...c, isFlipped: true })));
    }
    
    // Attendre que les cartes soient retournées avant de calculer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Animation de calcul des points
    console.log('📊 Calcul des points...');
    
    // Calculer les points carte par carte avec animation
    let p1Total = 0;
    let p2Total = 0;
    
    // Afficher un message pour le début du calcul
    setQuickDiscardFlash('Calcul des points...');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Calculer et afficher les points du joueur 1 (cartes du serveur)
    for (const card of p1Cards) {
      if (card.value !== -1) {
        const points = getCardScore(card.value);
        p1Total += points;
        // Adapter l'affichage en fonction de qui je suis
        const displayName = iAmPlayer1 ? 'Toi' : 'Adversaire';
        setQuickDiscardFlash(`${displayName}: +${points} points (${p1Total} total)`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Afficher le total du joueur 1
    const player1DisplayName = iAmPlayer1 ? 'Toi' : 'Adversaire';
    setQuickDiscardFlash(`${player1DisplayName}: ${p1Total} points au total`);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Calculer et afficher les points du joueur 2 (cartes du serveur)
    for (const card of p2Cards) {
      if (card.value !== -1) {
        const points = getCardScore(card.value);
        p2Total += points;
        // Adapter l'affichage en fonction de qui je suis
        const displayName = iAmPlayer1 ? 'Adversaire' : 'Toi';
        setQuickDiscardFlash(`${displayName}: +${points} points (${p2Total} total)`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Afficher le total du joueur 2
    const player2DisplayName = iAmPlayer1 ? 'Adversaire' : 'Toi';
    setQuickDiscardFlash(`${player2DisplayName}: ${p2Total} points au total`);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Déterminer le gagnant (le joueur avec le MOINS de points gagne)
    let winnerKey: 'player1' | 'player2' | null = null;
    if (p1Total < p2Total) {
      winnerKey = 'player1';
      setQuickDiscardFlash(`${player1DisplayName} gagne avec ${p1Total} points contre ${p2Total}!`);
    } else if (p2Total < p1Total) {
      winnerKey = 'player2';
      setQuickDiscardFlash(`${player2DisplayName} gagne avec ${p2Total} points contre ${p1Total}!`);
    } else {
      setQuickDiscardFlash(`Égalité! ${p1Total} points partout!`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    setQuickDiscardFlash(null);
    
    // Déterminer si le joueur actuel a gagné ou perdu
    let iWon = false;
    
    if (winnerKey === 'player1' && iAmPlayer1) iWon = true;
    if (winnerKey === 'player2' && !iAmPlayer1) iWon = true;
    
    // Affichage overlay victoire/égalité personnalisé
    if (winnerKey) {
      console.log(`🏆 Le gagnant est: ${winnerKey} avec ${winnerKey === 'player1' ? p1Total : p2Total} points`);
      console.log(`🏆 Le joueur actuel a ${iWon ? 'gagné' : 'perdu'} la manche`);
      
      // Utiliser iWon pour déterminer quel joueur a gagné
      // Cela permet d'afficher le bon message même si les cartes sont inversées
      setWinner(iWon ? (iAmPlayer1 ? 'player1' : 'player2') : (iAmPlayer1 ? 'player2' : 'player1'));
      setShowVictory(true);
    }

    // Après 2.5s, mettre à jour scores et afficher scoreboard
    setTimeout(() => {
      setShowVictory(false);
      if (winnerKey) {
        const loserKey: 'player1' | 'player2' = winnerKey === 'player1' ? 'player2' : 'player1';
        const loserTotal = loserKey === 'player1' ? p1Total : p2Total;
        setScores((prev) => ({
          player1: prev.player1 + (loserKey === 'player1' ? loserTotal : 0),
          player2: prev.player2 + (loserKey === 'player2' ? loserTotal : 0)
        }));
      }
      setShowScoreboard(true);
    }, 2500);
  }, [tableData]);

  return { triggerShowTime, handleShowTime };
}
