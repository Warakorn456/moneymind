import { createNavigationContainerRef } from '@react-navigation/native';

// Global navigation ref so components rendered outside a navigator
// (e.g. the overlay SidebarDrawer) can navigate and read the current route.
export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as any)(name, params);
  }
}

export function getCurrentRouteName(): string {
  if (navigationRef.isReady()) {
    return navigationRef.getCurrentRoute()?.name ?? '';
  }
  return '';
}
