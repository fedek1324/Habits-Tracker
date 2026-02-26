export const getDateString = (date: Date | number | string) : string => {
    const dateCopy = new Date(date);
    // add timezone offest to get same day time but in ISO format
    return new Date(dateCopy.getTime() - dateCopy.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

export const getDate00 = (date: Date | number | string) : Date => {
    const dateCopy = new Date(date);
    dateCopy.setHours(0, 0, 0, 0);
    return dateCopy;
}
