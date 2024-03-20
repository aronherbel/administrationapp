const berechneBilanz = require('../server');

const Rechnung = {
    aggregate: jest.fn().mockImplementation(async () => {
        return [
            { _id: null, total: 100 }, // Beispielwert für Soll
            { _id: null, total: 50 },  // Beispielwert für Haben
        ];
    })
};


describe("Berechnung der Bilanz", () => {
    test("Berechnung mit positiven Werten", async () => {
        // Aufruf der Funktion mit dem gemockten Rechnung-Modell
        const bilanz = await berechneBilanz(Rechnung);

        // Erwartete Ergebnisse
        const expectedSoll = 100;
        const expectedHaben = 50;
        const expectedDifferenz = 50;

        // Überprüfung der Ergebnisse
        expect(bilanz.Soll).toBe(expectedSoll);
        expect(bilanz.Haben).toBe(expectedHaben);
        expect(bilanz.kasseBankDiffernz).toBe(expectedDifferenz);
    });

});