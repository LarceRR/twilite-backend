/**
 * Platform permission catalog. Names are `module.resource.action` with optional `*`.
 * Public auth routes stay @Public; login/register entries exist for docs/group assignment only.
 */
export type PermissionCatalogEntry = {
  readonly name: string;
  readonly descriptionEn: string;
  readonly descriptionRu: string;
  readonly module: string;
};

function entry(name: string, descriptionEn: string, descriptionRu: string): PermissionCatalogEntry {
  const module = name.split('.')[0] ?? name;
  return { name, descriptionEn, descriptionRu, module };
}

export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  // --- twilite.auth ---
  entry('twilite.auth.login', 'Log in to the application', 'Вход в приложение'),
  entry('twilite.auth.register', 'Register a new account', 'Регистрация нового аккаунта'),
  entry('twilite.auth.logout', 'Log out of the application', 'Выход из приложения'),
  entry('twilite.auth.sessions.view', 'View own sessions', 'Просмотр своих сессий'),
  entry('twilite.auth.sessions.revoke', 'Revoke sessions', 'Отзыв сессий'),
  entry('twilite.auth.qr.inspect', 'Inspect QR login challenge', 'Просмотр QR-входа'),
  entry('twilite.auth.qr.approve', 'Approve QR login', 'Подтверждение QR-входа'),
  entry('twilite.auth.qr.deny', 'Deny QR login', 'Отклонение QR-входа'),
  entry('twilite.auth.sessions.*', 'All session actions', 'Все действия с сессиями'),
  entry('twilite.auth.qr.*', 'All QR login actions', 'Все действия QR-входа'),
  entry('twilite.auth.*', 'All authentication actions', 'Все действия аутентификации'),

  // --- twilite.users ---
  entry('twilite.users.view', 'View user profiles', 'Просмотр профилей пользователей'),
  entry('twilite.users.edit', 'Edit user profiles', 'Редактирование профилей пользователей'),
  entry('twilite.users.delete', 'Delete users', 'Удаление пользователей'),
  entry('twilite.users.*', 'All user management actions', 'Все действия управления пользователями'),

  // --- twilite.billing ---
  entry('twilite.billing.view', 'View billing state', 'Просмотр состояния подписки'),
  entry('twilite.billing.*', 'All billing actions', 'Все действия биллинга'),

  // --- twilite.media ---
  entry('twilite.media.upload', 'Upload media', 'Загрузка медиа'),
  entry('twilite.media.confirm', 'Confirm media upload', 'Подтверждение загрузки медиа'),
  entry('twilite.media.*', 'All media actions', 'Все действия с медиа'),

  // --- twilite.analytics ---
  entry('twilite.analytics.track', 'Track analytics events', 'Отправка аналитики'),
  entry('twilite.analytics.*', 'All analytics actions', 'Все действия аналитики'),

  // --- ta.adminPanel ---
  entry('ta.adminPanel.access', 'Access the admin panel', 'Доступ к админ-панели'),
  entry(
    'ta.adminPanel.users.view',
    'View user list in admin panel',
    'Просмотр списка пользователей в админ-панели',
  ),
  entry(
    'ta.adminPanel.permissions.view',
    'View permission list in admin panel',
    'Просмотр списка прав в админ-панели',
  ),
  entry(
    'ta.adminPanel.groups.view',
    'View group list in admin panel',
    'Просмотр списка групп в админ-панели',
  ),
  entry(
    'ta.adminPanel.groups.edit',
    'Edit groups and inheritance in admin panel',
    'Редактирование групп и наследования в админ-панели',
  ),

  // --- tpg ---
  entry('tpg.editor.view', 'View the editor', 'Просмотр редактора'),
  entry('tpg.editor.createProject', 'Create a new project', 'Создание нового проекта'),
  entry('tpg.editor.edit', 'Edit projects', 'Редактирование проектов'),
  entry('tpg.editor.delete', 'Delete projects', 'Удаление проектов'),
  entry(
    'tpg.editor.purge',
    'Permanently delete a project with all its objects and files',
    'Полное удаление проекта со всеми объектами и файлами',
  ),
  entry('tpg.editor.*', 'All editor actions', 'Все действия редактора'),
  entry('tpg.pixelate.use', 'Use pixelate endpoints', 'Использование пикселизации'),
  entry('tpg.themes.create', 'Create and submit app themes', 'Создание и отправка тем приложения'),
  entry('tpg.themes.moderate', 'Moderate submitted app themes', 'Модерация тем приложения'),
  entry('tpg.themes.*', 'All theme studio actions', 'Все действия студии тем'),
  entry('tpg.pixelObjects.create', 'Create a pixel object draft', 'Создание пиксельного объекта'),
  entry(
    'tpg.pixelObjects.submit',
    'Submit a pixel object for moderation',
    'Отправка пиксельного объекта на модерацию',
  ),
  entry(
    'tpg.pixelObjects.moderate',
    'Publish or reject pixel objects',
    'Публикация и отклонение пиксельных объектов',
  ),
  entry(
    'tpg.pixelObjects.readPublished',
    'Read the published pixel object catalog',
    'Чтение опубликованного каталога пиксельных объектов',
  ),
  entry(
    'tpg.pixelObjects.purge',
    'Permanently delete a pixel object and its files',
    'Полное удаление пиксельного объекта и его файлов',
  ),
  entry('tpg.pixelObjects.*', 'All pixel object actions', 'Все действия с пиксельными объектами'),
] as const;

export const USER_GROUP_PERMISSIONS: readonly string[] = [
  'twilite.auth.*',
  'twilite.users.view',
  'twilite.users.edit',
  'twilite.billing.view',
  'twilite.media.*',
  'twilite.analytics.track',
  'tpg.editor.view',
  'tpg.pixelate.use',
  'tpg.pixelObjects.readPublished',
];

export const ARTIST_GROUP_PERMISSIONS: readonly string[] = [
  'tpg.editor.createProject',
  'tpg.editor.edit',
  'tpg.editor.delete',
  'tpg.themes.create',
  'tpg.pixelObjects.create',
  'tpg.pixelObjects.submit',
];

export const ADMIN_GROUP_PERMISSIONS: readonly string[] = [
  'ta.adminPanel.access',
  'ta.adminPanel.users.view',
  'ta.adminPanel.permissions.view',
  'ta.adminPanel.groups.view',
  'ta.adminPanel.groups.edit',
  'twilite.users.*',
  'twilite.auth.*',
  'tpg.editor.purge',
  'tpg.themes.moderate',
  'tpg.pixelObjects.moderate',
  'tpg.pixelObjects.purge',
];
