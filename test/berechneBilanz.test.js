const berechneBilanz = require('../server');

const Rechnung = {
    aggregate: jest.fn().mockImplementation(async () => {
        return [
            { _id: null, total: 100 },
            { _id: null, total: 50 },
        ];
    })
};


describe("Berechnung der Bilanz", () => {
    test("Berechnung mit positiven Werten", async () => {
        
        const bilanz = await berechneBilanz(Rechnung);

        
        const expectedSoll = 100;
        const expectedHaben = 50;
        const expectedDifferenz = 50;

        
        expect(bilanz.Soll).toBe(expectedSoll);
        expect(bilanz.Haben).toBe(expectedHaben);
        expect(bilanz.kasseBankDiffernz).toBe(expectedDifferenz);
    });

});