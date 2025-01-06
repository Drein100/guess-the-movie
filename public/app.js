/**************************************
 * 1) Firebase Config ve Başlatma
 **************************************/
const firebaseConfig = {
    apiKey: "AIzaSyAAshQA4ax7B-Cm9Uth_1vWMvMsYhfYrhM",
    authDomain: "guess-the-movie-4cdb5.firebaseapp.com",
    projectId: "guess-the-movie-4cdb5",
    storageBucket: "guess-the-movie-4cdb5.firebasestorage.app",
    messagingSenderId: "716298207572",
    appId: "1:716298207572:web:b4235f66f802b3f6d908c1",
    measurementId: "G-B286QNNGWF"
  };  
  // Firebase Başlat
  firebase.initializeApp(firebaseConfig);
  
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  /**************************************
   * 2) TMDb API Bilgileri
   **************************************/
  const TMDB_API_KEY = "427f323096cbf6058c47782c87e83069";
  const BASE_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
  
  let genreMap = {};
  
  // Oyunla ilgili global değişkenler
  let currentMovieID = null;     // Seçilen filmin ID'si
  let currentMovieTitle = "";    // Filmin (TR başlığı) veya orijinal başlığı (küçük harf)
  let attempts = 0;              // Kullanıcının kullandığı tahmin hakkı
  const maxAttempts = 5;         // Toplam hak
  let score = 0;                 // Kullanıcının skoru
  let blurIndex = 0;             // Blur seviyesi index
  const blurLevels = [16, 13, 10, 7, 4]; // Blur seviyeleri
  
  // Oyun modu
  let currentMode = null; 
  
  // Aktif kullanıcı
  let currentUser = null;        
  let currentUserDocRef = null;  
  
  /**************************************
   * 3) HTML Elemanları Seçimi
   **************************************/
  // NAV
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  
  // Auth Section
  const authSection = document.getElementById("authSection");
  const userNameReg = document.getElementById("userNameReg");
  const emailReg = document.getElementById("emailReg");
  const passwordReg = document.getElementById("passwordReg");
  const registerBtn = document.getElementById("registerBtn");
  const userNameLogin = document.getElementById("userNameLogin");
  const passwordLogin = document.getElementById("passwordLogin");
  const loginUserNameBtn = document.getElementById("loginUserNameBtn");
  const authFeedback = document.getElementById("authFeedback");
  
  // Mod Section
  const modeSection = document.getElementById("modeSection");
  const modePopularBtn = document.getElementById("modePopularBtn");
  const modeIntermediateBtn = document.getElementById("modeIntermediateBtn");
  const modeRandomBtn = document.getElementById("modeRandomBtn");
  
  // Game Section
  const gameSection = document.getElementById("gameSection");
  const posterEl = document.getElementById("poster");
  const movieDetailsEl = document.getElementById("movieDetails");
  const guessInput = document.getElementById("guessInput");
  const guessBtn = document.getElementById("guessBtn");
  const feedbackEl = document.getElementById("feedback");
  const attemptsEl = document.getElementById("attempts");
  const scoreEl = document.getElementById("score");
  
  // Leaderboard
  const leaderboardList = document.getElementById("leaderboardList");
  
  /**************************************
   * 4) NAV Butonları
   **************************************/
  // "Giriş" butonuna tıklayınca auth ekranı aç, mod ve oyun ekranlarını kapat
  loginBtn.addEventListener("click", () => {
    authSection.classList.remove("hidden");
    modeSection.classList.add("hidden");
    gameSection.classList.add("hidden");
  });
  
  // "Çıkış Yap" butonu
  logoutBtn.addEventListener("click", async () => {
    await auth.signOut();
  });
  
  /**************************************
   * 5) Kayıt Ol (registerBtn)
   **************************************/
  registerBtn.addEventListener("click", async () => {
    const userName = userNameReg.value.trim();
    const email = emailReg.value.trim();
    const pass = passwordReg.value.trim();
  
    if (!userName || !email || !pass) {
      authFeedback.innerText = "Lütfen kullanıcı adı, e-posta ve şifre giriniz.";
      return;
    }
  
    try {
      // 1) userIndex/{userName} dokümanı var mı?
      const userNameDocRef = db.collection("userIndex").doc(userName);
      const userNameDoc = await userNameDocRef.get();
      if (userNameDoc.exists) {
        authFeedback.innerText = "Bu kullanıcı adı zaten kullanılıyor!";
        return;
      }
  
      // 2) Firebase Authentication (email+pass) ile kayıt
      const userCred = await auth.createUserWithEmailAndPassword(email, pass);
      const user = userCred.user;
  
      // 3) userIndex/{userName} → email eşlemesini kaydet
      await userNameDocRef.set({ email: email });
  
      // 4) leaderboard/{uid} dokümanı
      const docRef = db.collection("leaderboard").doc(user.uid);
      await docRef.set({
        userName: userName,
        score: 0,
        createdAt: new Date().toISOString()
      });
  
      authFeedback.innerText = "Kayıt başarılı! Oturum açıldı.";
    } catch (error) {
      authFeedback.innerText = error.message;
    }
  });
  
  /**************************************
   * 6) Kullanıcı Adı + Şifre ile Giriş
   **************************************/
  loginUserNameBtn.addEventListener("click", async () => {
    const uName = userNameLogin.value.trim();
    const pass = passwordLogin.value.trim();
  
    if (!uName || !pass) {
      authFeedback.innerText = "Kullanıcı adı ve şifre gerekli.";
      return;
    }
  
    try {
      // 1) userIndex/{userName} dokümanından email'i çek
      const userNameDocRef = db.collection("userIndex").doc(uName);
      const userNameDoc = await userNameDocRef.get();
      if (!userNameDoc.exists) {
        authFeedback.innerText = "Kullanıcı adı bulunamadı!";
        return;
      }
      const email = userNameDoc.data().email;
  
      // 2) email+pass ile giriş
      await auth.signInWithEmailAndPassword(email, pass);
      authFeedback.innerText = "Giriş başarılı!";
    } catch (error) {
      authFeedback.innerText = error.message;
    }
  });
  
  /**************************************
   * 7) Auth State Değişimi
   **************************************/
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
  
      authSection.classList.add("hidden");
  
      // Kullanıcı giriş yaptıktan sonra mod seçme ekranını açalım.
      modeSection.classList.remove("hidden");
      gameSection.classList.add("hidden");
  
      // Skor dokümanını al
      const docRef = db.collection("leaderboard").doc(user.uid);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        score = docSnap.data().score || 0;
        currentUserDocRef = docRef;
      } else {
        // Kayıt aşamasında oluşmuş olması lazım, yine de...
        await docRef.set({ userName: "Bilinmiyor", score: 0 });
        currentUserDocRef = docRef;
        score = 0;
      }
  
      // localStorage'dan eski durumu oku
      loadLocalStorageState();
  
      // Leaderboard dinle
      listenToLeaderboard();
  
      // Tür listesini çek
      await fetchGenres();
  
      // Seçilen moda göre film yükle
      if (currentMode) {
        modeSection.classList.add("hidden");
        gameSection.classList.remove("hidden");
  
        // Eğer daha önce film seçilmişse devam et
        if (currentMovieID) {
          await loadMovieByID(currentMovieID);
          restoreBlurAndAttempts();
        } else {
          loadNewMovie();
        }
      }
    } else {
      // Kullanıcı çıkış yaptı
      currentUser = null;
      currentUserDocRef = null;
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
  
      // Ekranları gizle
      authSection.classList.add("hidden");
      modeSection.classList.add("hidden");
      gameSection.classList.add("hidden");
  
      // localStorage'ı temizlemek isterseniz:
      // localStorage.clear();
    }
  });
  
  /**************************************
   * 8) MOD SEÇİM BUTONLARI
   **************************************/
  modePopularBtn?.addEventListener("click", () => {
    currentMode = "popular";
    localStorage.setItem("currentMode", currentMode);
  
    modeSection.classList.add("hidden");
    gameSection.classList.remove("hidden");
  
    clearLocalStorageGameState();
    loadNewMovie();
  });
  
  modeIntermediateBtn?.addEventListener("click", () => {
    currentMode = "intermediate";
    localStorage.setItem("currentMode", currentMode);
  
    modeSection.classList.add("hidden");
    gameSection.classList.remove("hidden");
  
    clearLocalStorageGameState();
    loadNewMovie();
  });
  
  modeRandomBtn?.addEventListener("click", () => {
    currentMode = "random";
    localStorage.setItem("currentMode", currentMode);
  
    modeSection.classList.add("hidden");
    gameSection.classList.remove("hidden");
  
    clearLocalStorageGameState();
    loadNewMovie();
  });
  
  /**************************************
   * 9) Leaderboard (Herkese Açık)
   **************************************/
  function listenToLeaderboard() {
    db.collection("leaderboard")
      .orderBy("score", "desc")
      .limit(10)
      .onSnapshot((snapshot) => {
        leaderboardList.innerHTML = "";
        snapshot.forEach((doc) => {
          const data = doc.data();
          const li = document.createElement("li");
          li.innerText = `${data.userName} - Skor: ${data.score}`;
          leaderboardList.appendChild(li);
        });
      });
  }
  
  /**************************************
   * 10) TMDb: Tür Listesi & Film Yükleme
   **************************************/
  async function fetchGenres() {
    try {
      const url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=tr-TR`;
      const res = await fetch(url);
      const data = await res.json();
      data.genres.forEach((genre) => {
        genreMap[genre.id] = genre.name;
      });
    } catch (error) {
      console.error("Tür listesi çekilemedi:", error);
    }
  }
  

  async function loadNewMovie() {
    try {
      let randomPage;
      let discoverUrl;
  
      // currentMode değerini kontrol et, yoksa localStorage'dan al
      if (!currentMode) {
        currentMode = localStorage.getItem("currentMode") || "random";
      }
  
      if (currentMode === "popular") {
        // Popüler mod: en popüler ilk 100 film (~5 sayfa)
        randomPage = Math.floor(Math.random() * 5) + 1;
        discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&page=${randomPage}&language=tr-TR&with_original_language=en&sort_by=popularity.desc`;
      } else if (currentMode === "intermediate") {
        // Orta mod: ilk 1000 film (~50 sayfa)
        randomPage = Math.floor(Math.random() * 50) + 1;
        discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&page=${randomPage}&language=tr-TR&with_original_language=en&sort_by=popularity.desc`;
      } else {
        // Sinefil (Random) mod: 1–500 sayfa
        randomPage = Math.floor(Math.random() * 500) + 1;
        discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&page=${randomPage}&language=tr-TR&with_original_language=en&sort_by=popularity.desc`;
      }
  
      discoverUrl = discoverUrl.replace(/\s+/g, "");
  
  
      const response = await fetch(discoverUrl);
      const data = await response.json();
      const results = data.results;
  
      if (results && results.length > 0) {
        const chosenMovie = results[Math.floor(Math.random() * results.length)];
        currentMovieID = chosenMovie.id;
        localStorage.setItem("currentMovieID", currentMovieID.toString());
  
  
        // Film detaylarını almak için loadMovieByID çağırıyoruz
        await loadMovieByID(currentMovieID);
  
        // Oyun sıfırla
        resetGame();
      }
    } catch (error) {
      console.error("Film yüklenirken hata:", error);
    }
  }
  
  /**
   * loadMovieByID():
   * localStorage'da kayıtlı ID varsa, o film ID'den devam et.
   */
  async function loadMovieByID(movieID) {
    try {
      const movieUrl = `https://api.themoviedb.org/3/movie/${movieID}?api_key=${TMDB_API_KEY}&language=tr-TR`;
      const response = await fetch(movieUrl);
      const data = await response.json();
      updateMovieUI(data);
    } catch (error) {
      console.error("Film ID ile yüklenirken hata:", error);
    }
  }
  
  function updateMovieUI(movie) {
    // Hem TR başlık (title) hem orijinal başlık (original_title)
    currentMovieTitle = movie.title?.toLowerCase() || "";
    const localizedTitle = movie.original_title?.toLowerCase() || "";
  
    // Poster
    posterEl.src = movie.poster_path
      ? BASE_IMAGE_URL + movie.poster_path
      : "https://via.placeholder.com/400x600?text=No+Poster";
  
    // Detaylar
    const year = movie.release_date?.split("-")[0] || "N/A";
    const rating = movie.vote_average?.toFixed(1) || "N/A";
    const g = movie.genres 
      ? movie.genres.map((genre) => genre.name).join(", ")
      : movie.genre_ids?.map((id) => genreMap[id]).join(", ") || "Bilinmiyor";
  
    movieDetailsEl.innerHTML = `
      <p>Yıl: ${year}</p>
      <p>Puan: ${rating}</p>
      <p>Tür: ${g}</p>
    `;
  
    // Local Storage'a kaydet (Her iki başlık)
    localStorage.setItem("currentMovieTitle", currentMovieTitle);
    localStorage.setItem("localizedMovieTitle", localizedTitle);
  }
  
  /**************************************
   * 11) Oyun Mantığı (Tahmin)
   **************************************/
  guessBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    if (attempts >= maxAttempts) {
      return; // 5 hakkı dolmuş, tıklasa da işlem yapma
    }
  
    const userGuess = guessInput.value.trim().toLowerCase();
    if (!userGuess) return;
  
    attempts++;
    localStorage.setItem("attempts", attempts.toString());
  
    const localizedMovieTitle = localStorage.getItem("localizedMovieTitle") || "";
    const originalMovieTitle = localStorage.getItem("currentMovieTitle") || "";
  
    // Doğru tahmin mi?
    if (userGuess === originalMovieTitle || userGuess === localizedMovieTitle) {
      feedbackEl.innerText = "Doğru bildiniz!";
      posterEl.style.filter = "blur(0px)";
      score++;
      localStorage.setItem("score", score.toString());
      await updateScore(score);
  
      setTimeout(() => {
        clearLocalStorageGameState();
        loadNewMovie();
      }, 1000);
  
    } else if (attempts < maxAttempts) {
      // Yanlış ama hakkı var
      blurIndex++;
      localStorage.setItem("blurIndex", blurIndex.toString());
      if (blurIndex < blurLevels.length) {
        posterEl.style.filter = `blur(${blurLevels[blurIndex]}px)`;
      }
      feedbackEl.innerText = `Yanlış! Kalan hakkınız: ${maxAttempts - attempts}`;
    } else {
      // 5. hakkı da gitti
      feedbackEl.innerText = `Bilemediniz. Doğru cevap: ${originalMovieTitle.charAt(0).toUpperCase() + originalMovieTitle.slice(1)}`;
      posterEl.style.filter = "blur(0px)";
      setTimeout(() => {
        clearLocalStorageGameState();
        loadNewMovie();
      }, 1500);
    }
    updateUI();
  });
  
  /**************************************
   * 12) Oyun Sıfırlama & UI
   **************************************/
  function resetGame() {
    attempts = 0;
    blurIndex = 0;
    feedbackEl.innerText = "";
    guessInput.value = "";
    posterEl.style.filter = `blur(${blurLevels[blurIndex]}px)`;
  
    localStorage.setItem("attempts", "0");
    localStorage.setItem("blurIndex", "0");
    updateUI();
  }
  
  function updateUI() {
    attemptsEl.innerText = `Hak: ${attempts} / ${maxAttempts}`;
    scoreEl.innerText = `Skor: ${score}`;
  }
  
  /**************************************
   * 13) Skor Güncelleme (Firestore)
   **************************************/
  async function updateScore(newScore) {
    if (!currentUserDocRef) return;
    try {
      await currentUserDocRef.update({ score: newScore });
    } catch (error) {
      console.error("Skor güncellenemedi:", error);
    }
  }
  
  /**************************************
   * 14) Local Storage: Oyun Durumu
   **************************************/
  function loadLocalStorageState() {
    // Film ID, attempts, blurIndex, score, mode
    const storedMovieID = localStorage.getItem("currentMovieID");
    if (storedMovieID) {
      currentMovieID = parseInt(storedMovieID, 10);
    }
    const storedAttempts = localStorage.getItem("attempts");
    if (storedAttempts) {
      attempts = parseInt(storedAttempts, 10);
    }
    const storedBlurIndex = localStorage.getItem("blurIndex");
    if (storedBlurIndex) {
      blurIndex = parseInt(storedBlurIndex, 10);
    }
    const storedScore = localStorage.getItem("score");
    if (storedScore) {
      score = parseInt(storedScore, 10);
    }
    const storedMode = localStorage.getItem("currentMode");
    if (storedMode) {
      currentMode = storedMode;
    }
  }
  
  function restoreBlurAndAttempts() {
    posterEl.style.filter = `blur(${blurLevels[blurIndex]}px)`;
    updateUI();
  }
  
  function clearLocalStorageGameState() {
    localStorage.removeItem("currentMovieID");
    localStorage.removeItem("attempts");
    localStorage.removeItem("blurIndex");
    localStorage.removeItem("currentMovieTitle");
    localStorage.removeItem("localizedMovieTitle");
    // score'ı silmeyebiliriz, Firestore'da güncelleniyor
  }
  