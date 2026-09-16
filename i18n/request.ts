import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';
 
export default getRequestConfig(async () => {
  return {
    locale: "unsupported_locale",
    messages: null as any
  };
});
