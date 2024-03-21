const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');

const app = express();

// MongoDB-Verbindung herstellen
mongoose.connect('mongodb+srv://aron:1234@atlascluster.ixxacfo.mongodb.net/administration?retryWrites=true&w=majority&appName=AtlasCluster')
    .then(() => console.log('DB connection successful'))
    .catch(err => console.error(err));

// MongoDB-Modell für Benutzer
const User = mongoose.model(
    'User', {
        name: String,
        email: String,
        password: String,
        isBuchhalter: Boolean,
    }, 'user');


const Rechnung = mongoose.model('Rechnung', {
    betrag: Number,
    beschreibung: String,
    kontoSoll: String,
    kontoHaben: String,
});    

app.set('view-engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session({
    secret: 'your_secret_here', // Setzen Sie hier Ihren eigenen geheimen Schlüssel ein
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(express.json());


// Passport-Konfiguration
const initializePassport = require('./passport-config');
initializePassport(
  passport,
  async (email) => {
    try {
      const user = await User.findOne({ email: email });
      return user;
    } catch (error) {
      console.error(error);
      return null;
    }
  },
  async (id) => {
    try {
      const user = await User.findById(id);
      return user;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
);



// Routen
app.get('/', checkAuthenticated, (req, res) => {
    res.render('index.ejs', { name: req.user.name, isBuchhalter: req.user.isBuchhalter});
});

app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs');
});

app.post('/login',
    checkNotAuthenticated,
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true,
    })
);

app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render('register.ejs');
});

app.post('/register', checkNotAuthenticated, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const newUser = new User({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            isBuchhalter: req.body.isBuchhalter
        });
        await newUser.save();
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.redirect('/register');
    }
});



app.delete('/logout', (req, res) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    next();
}

app.get('/rechnung', checkAuthenticated, async (req, res) => {
    res.render('rechnung.ejs')
});

app.post('/rechnung', checkAuthenticated, async (req, res) => {
    try{
      const {betrag, beschreibung, kontoSoll, kontoHaben} = req.body;
      
      //speichern in Datenbank
      const neueRechnung = new Rechnung({
          betrag, 
          beschreibung, 
          kontoSoll, 
          kontoHaben
      });
      await neueRechnung.save();
      res.redirect('/');
      
    } catch (error){
      console.error(error);
      res.status(500).send('Fehler beim Speichern der Rechnung');
    }
  })


  app.get('/bilanz', checkAuthenticated, async (req, res) => {
    try {

        // Erfolgsrechnung berechnen
        const erfolgsrechnung = await berechneErfolgsrechnung();
        
        // Bilanz berechnen
        const bilanz = await berechneBilanz();
        
        
        res.render('bilanz.ejs', { erfolgsrechnung, bilanz });
    } catch (error) {
        console.error(error);
        res.status(500).send('Fehler beim Berechnen der Bilanz');
    }
});

//Berechnung der Erfolgsrechnung
async function berechneErfolgsrechnung() {
    try {
        // Beträge mit Warenaufwand im Soll
        const warenaufwandSoll = await Rechnung.aggregate([
            { $match: { kontoSoll: "Warenaufwand" } },
            { $group: { _id: null, total: { $sum: "$betrag" } } }
        ]);

        // Beträge mit Warenaufwand im Haben
        const warenaufwandHaben = await Rechnung.aggregate([
            { $match: { kontoHaben: "Warenaufwand" } },
            { $group: { _id: null, total: { $sum: "$betrag" } } }
        ]);

        // Beträge mit Warenertrag im Haben
        const warenertragHaben = await Rechnung.aggregate([
            { $match: { kontoHaben: "Warenertrag" } },
            { $group: { _id: null, total: { $sum: "$betrag" } } }
        ]);

        const warenertragSoll = await Rechnung.aggregate([
            { $match: { kontoSoll: "Warenertrag" } },
            { $group: { _id: null, total: { $sum: "$betrag" } } }
        ]);


        // Berechnung

        warenaufwandBerrechnung = (warenaufwandSoll.length > 0 ? warenaufwandSoll[0].total : 0) - (warenaufwandHaben.length > 0 ? warenaufwandHaben[0].total : 0);

        warenertragBerrechnung = (warenertragHaben.length > 0 ? warenertragHaben[0].total : 0) - (warenertragSoll.length > 0 ? warenertragSoll[0].total : 0)

        
        const erfolgrechnung = {
            warenaufwand: warenaufwandBerrechnung,
            warenertrag: warenertragBerrechnung,
            differenz: warenertragBerrechnung - warenaufwandBerrechnung
        };

        return erfolgrechnung;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Bilanz berrechnen
async function berechneBilanz() {
    try {
        // Beträge mit Kasse oder Bank im Soll
        const kasseBankSoll = await Rechnung.aggregate([
            { $match: { $or: [{ kontoSoll: "Kasse" }, { kontoSoll: "Bank" }] } },
            { $group: { _id: null, total: { $sum: "$betrag" } } }
        ]);

        // Beträge mit Kasse oder Bank im Haben
        const kasseBankHaben = await Rechnung.aggregate([
            { $match: { $or: [{ kontoHaben: "Kasse" }, { kontoHaben: "Bank" }] } },
            { $group: { _id: null, total: { $sum: "$betrag" } } }
        ]);

        // Berechnung des Ergebnisses

        const berechnungKasseBankSoll = (kasseBankSoll.length > 0 ? kasseBankSoll[0].total : 0);
        const berechnungKasseBankHaben = (kasseBankHaben.length > 0 ? kasseBankHaben[0].total : 0);

        const bilanz = {
            Soll: berechnungKasseBankSoll,
            Haben: berechnungKasseBankHaben,
            kasseBankDiffernz: berechnungKasseBankSoll - berechnungKasseBankHaben,
        };


        return bilanz;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// mit post funktioniert es aber ich muss so, weil ich hab sonsnt kein Update
app.patch('/changeName', checkAuthenticated, async (req, res) => {
    try {
        const newName = req.body.newName;
        const userId = req.user._id; 

        
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId }, 
            { $set: { name: newName } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).send('Benutzer nicht gefunden');
        }

        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Fehler beim Ändern des Namens');
    }
});



app.listen(3000, () => {
    console.log('Server läuft');
});


module.exports = berechneBilanz;