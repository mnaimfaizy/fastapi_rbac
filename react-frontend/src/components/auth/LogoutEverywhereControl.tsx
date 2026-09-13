import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store/hooks';
import { logoutAllUser } from '../../store/slices/authSlice';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type LogoutEverywhereControlProps = {
  children: ReactNode;
};

export function LogoutEverywhereControl({
  children,
}: LogoutEverywhereControlProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleConfirm = async () => {
    await dispatch(logoutAllUser());
    navigate('/login');
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out everywhere?</AlertDialogTitle>
          <AlertDialogDescription>
            This signs you out of every device. You will need to log in again
            here and on any other sessions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Log out everywhere
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
