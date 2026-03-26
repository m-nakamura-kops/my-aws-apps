'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SuccessAlert from '@/components/ui/SuccessAlert';
import LoadingButton from '@/components/ui/LoadingButton';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nameKanji: '',
    nameKana: '',
    tel: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (formData.password !== formData.confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (formData.password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setIsLoading(true);

    try {
      await register(
        formData.email,
        formData.password,
        formData.nameKanji,
        formData.nameKana,
        formData.tel
      );
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <SuccessAlert 
            message="登録が完了しました。ログイン画面にリダイレクトします..."
            className="mb-4"
          />
          <LoadingSpinner text="リダイレクト中..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            新規登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            QRコード打刻システムに登録
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <ErrorAlert 
              message={error} 
              onDismiss={() => setError('')}
            />
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="example@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="nameKanji" className="block text-sm font-medium text-gray-700">
                氏名（漢字）
              </label>
              <input
                id="nameKanji"
                name="nameKanji"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="山田 太郎"
                value={formData.nameKanji}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="nameKana" className="block text-sm font-medium text-gray-700">
                氏名（カナ）
              </label>
              <input
                id="nameKana"
                name="nameKana"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="ヤマダ タロウ"
                value={formData.nameKana}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="tel" className="block text-sm font-medium text-gray-700">
                電話番号
              </label>
              <input
                id="tel"
                name="tel"
                type="tel"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="090-1234-5678"
                value={formData.tel}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="8文字以上"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="パスワードを再入力"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <LoadingButton
              type="submit"
              loading={isLoading}
              variant="primary"
              className="w-full"
            >
              登録
            </LoadingButton>
          </div>

          <div className="text-center">
            <a
              href="/login"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              既にアカウントをお持ちの方はこちら
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
