export const getDateString = (date: Date) : string => {
    // add timezone offest to get same day time but in ISO format
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}