import dayjs from "@/configs/date";

export const getWeekRange = (
  value: dayjs.ConfigType,
  weekStartDay = 0
) => {
  const base = dayjs(value);
  const reference = base.isValid() ? base : dayjs();
  const currentDay = reference.day();
  const offset = (currentDay - weekStartDay + 7) % 7;
  const weekStartDate = reference.subtract(offset, "day").startOf("day");
  const weekEndDate = weekStartDate.add(6, "day").startOf("day");

  return { weekStartDate, weekEndDate };
};
