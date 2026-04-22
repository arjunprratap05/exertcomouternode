exports.getFinancialYearSequence = () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    
    // In India, FY starts in April
    const startYear = month >= 4 ? year : year - 1;
    const endYear = (startYear + 1).toString().slice(-2);
    const fyLabel = `${startYear.toString().slice(-2)}-${endYear}`;
    
    return {
        label: fyLabel,
        dbKey: `cash_seq_FY_${startYear}_${endYear}`
    };
};