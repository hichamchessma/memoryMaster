import React from 'react';

export function useTestModeLogin({
  locationSearch,
  login,
  setMyPlayerInfo,
  setOpponentInfo,
}: {
  locationSearch: string;
  login: (user: any) => void;
  setMyPlayerInfo: React.Dispatch<React.SetStateAction<{name: string; isReal: boolean; userId: string} | null>>;
  setOpponentInfo: React.Dispatch<React.SetStateAction<{name: string; isReal: boolean; userId: string} | null>>;
}) {
  const searchParams = new URLSearchParams(locationSearch);
  const urlToken = searchParams.get('token');
  const urlTableId = searchParams.get('tableId');
  const urlUserId = searchParams.get('userId');

  const [testTableData, setTestTableData] = React.useState<any>(null);
  const [testModeInitialized, setTestModeInitialized] = React.useState(false);

  // Si on a des params URL (mode test), se connecter automatiquement
  React.useEffect(() => {
    if (urlToken && urlTableId && urlUserId && !testModeInitialized) {
      console.log('🧪 Test mode detected, auto-login...');
      setTestModeInitialized(true);
      
      // Stocker le token
      localStorage.setItem('token', urlToken);
      
      // Récupérer les données de la table
      fetch(`http://localhost:5000/api/game/tables/${urlTableId}`, {
        headers: {
          'Authorization': `Bearer ${urlToken}`
        }
      })
        .then(res => res.json())
        .then(data => {
          console.log('🧪 Table data loaded:', data);
          if (data.success && data.data) {
            // Stocker les données complètes de la table
            setTestTableData({
              tableId: urlTableId,
              tableCode: data.data.code,
              players: data.data.players,
              currentUserId: urlUserId
            });
            
            // Mettre à jour les joueurs
            const currentPlayer = data.data.players.find((p: any) => p._id === urlUserId);
            const otherPlayer = data.data.players.find((p: any) => p._id !== urlUserId);
            
            console.log('🧪 Current player:', currentPlayer);
            console.log('🧪 Other player:', otherPlayer);
            
            if (currentPlayer) {
              setMyPlayerInfo({
                name: `${currentPlayer.firstName} ${currentPlayer.lastName}`,
                isReal: true,
                userId: currentPlayer._id
              });
              
              // Créer un objet User complet pour l'authentification
              const testUser = {
                _id: currentPlayer._id,
                firstName: currentPlayer.firstName,
                lastName: currentPlayer.lastName,
                email: `${currentPlayer.firstName.toLowerCase()}@test.com`,
                age: 25,
                nationality: 'FR',
                elo: currentPlayer.elo || 1200,
                totalPoints: 0,
                avatar: '',
                token: urlToken,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              console.log('🧪 Logging in test user:', testUser);
              login(testUser as any);
            }
            
            if (otherPlayer) {
              setOpponentInfo({
                name: `${otherPlayer.firstName} ${otherPlayer.lastName}`,
                isReal: true,
                userId: otherPlayer._id
              });
            }
          }
        })
        .catch(err => console.error('❌ Error loading table:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken, urlTableId, urlUserId]);

  return { testTableData };
}
