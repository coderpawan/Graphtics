import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getOrdersByUser, getProductsByIds } from '../firebase/firestore';
import type { Address, UserPreferences } from '../types';
import { getProductListingImage } from '../lib/productMedia';

const membershipLabel = {
  bronze: 'Bronze Member',
  silver: 'Silver Member',
  gold: 'Gold Member',
  platinum: 'Platinum Member',
};

const fitOptions = ['Slim', 'Regular', 'Relaxed'];
const genderOptions: Array<'male' | 'female' | 'non-binary' | 'other'> = ['male', 'female', 'non-binary', 'other'];

export default function AccountPage() {
  const {
    user,
    loading,
    signOut,
    updateProfile,
    saveAddresses,
    savePreferences,
    saveNotificationSettings,
    saveCommunicationPreferences,
    uploadAvatar,
    changePassword,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'addresses' | 'preferences' | 'security'>('overview');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'non-binary' | 'other'>('other');
  const [dob, setDob] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressDraft, setAddressDraft] = useState<Omit<Address, 'id' | 'isDefaultShipping' | 'isDefaultBilling'>>({
    fullName: '',
    phone: '',
    pincode: '',
    state: '',
    city: '',
    landmark: '',
    addressLine1: '',
    addressLine2: '',
  });
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    savedSizes: [],
    preferredFit: 'regular',
    preferredBrands: [],
    preferredColors: [],
    preferredStyles: [],
    favouriteCategories: [],
  });
  const [notificationState, setNotificationState] = useState({
    pushNotifications: true,
    orderAlerts: true,
    marketing: false,
  });
  const [communicationState, setCommunicationState] = useState({
    emailUpdates: true,
    smsUpdates: false,
    offers: true,
    restockAlerts: true,
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['userOrders', user?.uid],
    queryFn: () => (user ? getOrdersByUser(user.uid) : Promise.resolve([])),
    enabled: Boolean(user),
  });

  const recentViewedIds = user?.recentlyViewed ?? [];
  const { data: recentProducts = [], isLoading: recentLoading } = useQuery({
    queryKey: ['recentlyViewed', recentViewedIds],
    queryFn: () => getProductsByIds(recentViewedIds),
    enabled: recentViewedIds.length > 0,
  });

  useEffect(() => {
    document.title = 'Graphtics | Account';
  }, []);

  useEffect(() => {
    if (!user) return;

    setName(user.name || '');
    setPhone(user.phone || '');
    setPhoneAlt(user.phoneAlt || '');
    setGender(user.gender || 'other');
    setDob(user.dob || '');
    setAddresses(user.savedAddresses || []);
    setPreferences(user.preferences || preferences);
    setNotificationState(user.notifications || notificationState);
    setCommunicationState(user.communicationPreferences || communicationState);
  }, [user]);

  const recentOrdersCount = orders.length;
  const wishlistCount = user?.wishlist?.length ?? 0;
  const recentlyViewedCount = recentViewedIds.length;

  const stats = useMemo(
    () => [
      { label: 'Wishlist', value: wishlistCount },
      { label: 'Orders', value: recentOrdersCount },
      { label: 'Recently viewed', value: recentlyViewedCount },
    ],
    [wishlistCount, recentOrdersCount, recentlyViewedCount],
  );

  if (loading || !user) {
    return <LoadingScreen />;
  }

  const handleAddressSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!addressDraft.fullName || !addressDraft.phone || !addressDraft.addressLine1 || !addressDraft.city || !addressDraft.pincode) {
      return;
    }

    const nextAddresses = editingAddressId
      ? addresses.map(address => (address.id === editingAddressId ? { ...address, ...addressDraft } : address))
      : [
          ...addresses,
          {
            id: `${Date.now()}`,
            ...addressDraft,
            isDefaultShipping: addresses.length === 0,
            isDefaultBilling: addresses.length === 0,
          },
        ];

    setAddresses(nextAddresses);
    await saveAddresses(nextAddresses);
    setEditingAddressId(null);
    setAddressDraft({ fullName: '', phone: '', pincode: '', state: '', city: '', landmark: '', addressLine1: '', addressLine2: '' });
  };

  const handleAddressEdit = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressDraft({
      fullName: address.fullName,
      phone: address.phone,
      pincode: address.pincode,
      state: address.state,
      city: address.city,
      landmark: address.landmark ?? '',
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? '',
    });
  };

  const handleAddressRemove = async (id: string) => {
    const nextAddresses = addresses.filter(address => address.id !== id);
    setAddresses(nextAddresses);
    await saveAddresses(nextAddresses);
  };

  const setDefaultAddress = async (id: string, type: 'shipping' | 'billing') => {
    const nextAddresses = addresses.map(address => ({
      ...address,
      isDefaultShipping: type === 'shipping' ? address.id === id : address.isDefaultShipping,
      isDefaultBilling: type === 'billing' ? address.id === id : address.isDefaultBilling,
    }));
    setAddresses(nextAddresses);
    await saveAddresses(nextAddresses);
  };

  const updatePersonalDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const primary = phone.trim();
    if (primary.length < 8) {
      return;
    }
    await updateProfile({ name: name.trim(), phone: primary, phoneAlt: phoneAlt.trim(), gender, dob });
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      setPasswordError('Unable to change your password. Please check your current password.');
    }
  };

  const handlePreferencesSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await savePreferences(preferences);
  };

  const handleNotificationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveNotificationSettings(notificationState);
    await saveCommunicationPreferences(communicationState);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Profile dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="mt-2 text-slate-400">Your personalized fashion account is ready to manage orders, preferences, and loyalty benefits.</p>
        </div>
        <Button onClick={() => signOut()} className="bg-white/5">Sign out</Button>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <Card className="p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-slate-900 shadow-lg">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xl font-semibold text-white">
                      {user.name
                        .split(' ')
                        .map(part => part[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm">
                  <p className="text-slate-400">Member since</p>
                  <p className="mt-2 text-white">{new Date(user.createdAt ?? Date.now()).toLocaleDateString()}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm">
                  <p className="text-slate-400">Loyalty status</p>
                  <p className="mt-2 text-white">{membershipLabel[user.membershipStatus ?? 'bronze']}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {stats.map(stat => (
                <div key={stat.label} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Recently viewed</h2>
              <div className="text-sm text-slate-400">Updated in real time</div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {recentLoading ? (
                <p className="text-slate-400">Loading recent views…</p>
              ) : recentProducts.length ? (
                recentProducts.slice(0, 4).map(product => (
                  <div key={product.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                    <img
                      src={getProductListingImage(product)}
                      alt={product.name}
                      className="h-28 w-full rounded-3xl object-cover"
                    />
                    <p className="mt-3 text-white">{product.name}</p>
                    <p className="text-sm text-slate-400">{product.category}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">No recently viewed products yet.</p>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-8">
          <div className="flex flex-wrap gap-3">
            {(['overview', 'profile', 'addresses', 'preferences', 'security'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-3xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-violet-500 text-white shadow-lg' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'profile'
                  ? 'Personal'
                  : tab === 'addresses'
                  ? 'Addresses'
                  : tab === 'preferences'
                  ? 'Preferences'
                  : 'Security'}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-6 text-slate-300">
                <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                  <h3 className="text-lg font-semibold text-white">Profile overview</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <p><span className="text-slate-400">Phone:</span> {user.phone || 'Not set'}</p>
                    <p><span className="text-slate-400">Alternate phone:</span> {user.phoneAlt || 'Not set'}</p>
                    <p><span className="text-slate-400">Gender:</span> {user.gender || 'Not set'}</p>
                    <p><span className="text-slate-400">Date of birth:</span> {user.dob || 'Not set'}</p>
                    <p><span className="text-slate-400">Primary shipping address:</span> {addresses.find(address => address.isDefaultShipping)?.addressLine1 ?? 'Not set'}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                  <h3 className="text-lg font-semibold text-white">Communication</h3>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300">
                    <p><span className="text-slate-400">Email updates:</span> {communicationState.emailUpdates ? 'Enabled' : 'Off'}</p>
                    <p><span className="text-slate-400">SMS updates:</span> {communicationState.smsUpdates ? 'Enabled' : 'Off'}</p>
                    <p><span className="text-slate-400">Offers:</span> {communicationState.offers ? 'Enabled' : 'Off'}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <form onSubmit={updatePersonalDetails} className="space-y-4 text-slate-300">
                <div>
                  <label className="text-sm text-slate-400">Full name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-400">Phone number (required)</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="At least 8 digits" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Alternate phone (optional)</label>
                    <Input value={phoneAlt} onChange={e => setPhoneAlt(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-400">Gender</label>
                    <select value={gender} onChange={e => setGender(e.target.value as any)} className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20">
                      {genderOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Date of birth</label>
                    <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Profile photo</label>
                  <div className="mt-3 flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] ?? null)} className="text-sm text-slate-300" />
                    <Button type="button" onClick={async () => avatarFile && uploadAvatar(avatarFile)} className="bg-white/5">Upload</Button>
                  </div>
                </div>
                <Button type="submit" className="w-full">Save profile updates</Button>
              </form>
            )}

            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  {addresses.length === 0 && <p className="text-slate-400">No saved addresses yet. Add one to speed up checkout.</p>}
                  {addresses.map(address => (
                    <div key={address.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-white font-semibold">{address.fullName}</p>
                          <p className="text-slate-400">{address.addressLine1}, {address.city}</p>
                          <p className="text-slate-400">{address.state}, {address.pincode}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <Button className="bg-white/5" onClick={() => handleAddressEdit(address)}>Edit</Button>
                          <Button className="bg-red-500/15 text-red-200" onClick={() => handleAddressRemove(address.id)}>Delete</Button>
                          <Button className="bg-white/5" onClick={() => setDefaultAddress(address.id, 'shipping')}>{address.isDefaultShipping ? 'Default shipping' : 'Set default shipping'}</Button>
                          <Button className="bg-white/5" onClick={() => setDefaultAddress(address.id, 'billing')}>{address.isDefaultBilling ? 'Default billing' : 'Set default billing'}</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddressSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
                  <h3 className="text-lg font-semibold text-white">{editingAddressId ? 'Edit address' : 'Add new address'}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input value={addressDraft.fullName} onChange={e => setAddressDraft({ ...addressDraft, fullName: e.target.value })} placeholder="Full name" />
                    <Input value={addressDraft.phone} onChange={e => setAddressDraft({ ...addressDraft, phone: e.target.value })} placeholder="Phone number" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input value={addressDraft.pincode} onChange={e => setAddressDraft({ ...addressDraft, pincode: e.target.value })} placeholder="Pincode / ZIP" />
                    <Input value={addressDraft.state} onChange={e => setAddressDraft({ ...addressDraft, state: e.target.value })} placeholder="State" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input value={addressDraft.city} onChange={e => setAddressDraft({ ...addressDraft, city: e.target.value })} placeholder="City" />
                    <Input value={addressDraft.landmark} onChange={e => setAddressDraft({ ...addressDraft, landmark: e.target.value })} placeholder="Landmark" />
                  </div>
                  <Input value={addressDraft.addressLine1} onChange={e => setAddressDraft({ ...addressDraft, addressLine1: e.target.value })} placeholder="Address line 1" />
                  <Input value={addressDraft.addressLine2} onChange={e => setAddressDraft({ ...addressDraft, addressLine2: e.target.value })} placeholder="Address line 2" />
                  <Button type="submit" className="w-full">Save address</Button>
                </form>
              </div>
            )}

            {activeTab === 'preferences' && (
              <form onSubmit={handlePreferencesSubmit} className="space-y-4 text-slate-300">
                <div>
                  <label className="text-sm text-slate-400">Saved sizes</label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['XS', 'S', 'M', 'L', 'XL'].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setPreferences(prev => ({
                          ...prev,
                          savedSizes: prev.savedSizes.includes(size)
                            ? prev.savedSizes.filter(item => item !== size)
                            : [...prev.savedSizes, size],
                        }))}
                        className={`rounded-full px-4 py-2 text-sm transition ${preferences.savedSizes.includes(size) ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-400">Preferred fit</label>
                    <select
                      value={preferences.preferredFit}
                      onChange={e => setPreferences(prev => ({ ...prev, preferredFit: e.target.value }))}
                      className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                    >
                      {fitOptions.map(option => (
                        <option key={option} value={option.toLowerCase()}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Preferred brands</label>
                    <Input value={preferences.preferredBrands.join(', ')} onChange={e => setPreferences(prev => ({ ...prev, preferredBrands: e.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Nike, Adidas, Zara" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-400">Preferred colors</label>
                    <Input value={preferences.preferredColors.join(', ')} onChange={e => setPreferences(prev => ({ ...prev, preferredColors: e.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Black, White, Navy" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Preferred styles</label>
                    <Input value={preferences.preferredStyles.join(', ')} onChange={e => setPreferences(prev => ({ ...prev, preferredStyles: e.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Streetwear, Minimal, Vintage" />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-400">Favourite categories</label>
                  <Input value={preferences.favouriteCategories.join(', ')} onChange={e => setPreferences(prev => ({ ...prev, favouriteCategories: e.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Tops, Denim, Outerwear" />
                </div>

                <Button type="submit" className="w-full">Save preferences</Button>
              </form>
            )}

            {activeTab === 'security' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4 text-slate-300">
                <div>
                  <p className="text-sm text-slate-400">Change password securely and keep your account safe.</p>
                </div>
                <Input type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                <Input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                {passwordError && <p className="text-sm text-rose-400">{passwordError}</p>}
                <Button type="submit" className="w-full">Update password</Button>

                <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <h3 className="text-sm font-semibold text-white">Notification settings</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    {Object.entries(notificationState).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={e => setNotificationState(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-400 focus:ring-violet-400"
                        />
                        <span className="text-slate-300">{key.replace(/([A-Z])/g, ' $1')}</span>
                      </label>
                    ))}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">Communication preferences</h3>
                  <div className="mt-3 space-y-3 text-sm">
                    {Object.entries(communicationState).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={e => setCommunicationState(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-violet-400 focus:ring-violet-400"
                        />
                        <span className="text-slate-300">{key.replace(/([A-Z])/g, ' $1')}</span>
                      </label>
                    ))}
                  </div>
                  <Button type="submit" className="mt-4 w-full">Save notification preferences</Button>
                </div>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
