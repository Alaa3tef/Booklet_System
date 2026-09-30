export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  active?: boolean;
  children?: NavItem[];
  expanded?: boolean;
   roles?: string[]; 
}
