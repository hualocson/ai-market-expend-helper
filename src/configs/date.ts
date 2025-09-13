import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

// enable plugin
dayjs.extend(customParseFormat);

export default dayjs;
