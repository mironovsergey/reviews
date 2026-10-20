import { useEffect, useId, useRef } from 'react';
import type { FC, MouseEvent, ReactNode } from 'react';
import styles from './dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  /** Вызывается при любом способе закрытия: кнопкой, клавишей Escape или нажатием на подложку. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * Модальное окно на элементе dialog.
 *
 * Окно открывается методом showModal: браузер сам удерживает фокус внутри
 * окна, закрывает его клавишей Escape и возвращает фокус элементу, с
 * которого окно открыли. Открытием распоряжается вызывающий, поэтому
 * закрытие окна самим браузером сообщается через onClose.
 *
 * Отступы заданы внутренней обертке, а не самому окну: так нажатие внутри
 * окна никогда не приходится на элемент dialog, и его можно отличить от
 * нажатия на подложку.
 */
export const Dialog: FC<DialogProps> = ({ open, title, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;

    if (dialog === null) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClick = (event: MouseEvent<HTMLDialogElement>): void => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleClick}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          <button className={styles.close} type="button" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
};
