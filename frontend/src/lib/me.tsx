'use client';
import { createContext, useContext } from 'react';
import type { User } from './api';

export const UserCtx = createContext<User>({ id: 0, name: '', role: '', email: '' });
export const useMe = () => useContext(UserCtx);
