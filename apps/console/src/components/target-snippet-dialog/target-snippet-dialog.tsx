import type { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { targetSnippetQuery } from '../../queries/widget';
import type { Target, TargetKind } from '../../schemas/target';
import { CopyableCode } from '../copyable-code/copyable-code';
import { Dialog } from '../dialog/dialog';
import { Loader } from '../loader/loader';
import { Message } from '../message/message';
import styles from './target-snippet-dialog.module.css';

interface DialogTexts {
  title: string;
  hint: string;
  hidden: string;
}

/** Тексты окна для каждого вида цели. */
const DIALOG_TEXTS: Readonly<Record<TargetKind, DialogTexts>> = {
  clinic: {
    title: 'Код для страницы клиники',
    hint:
      'Вставьте код на страницу этой клиники: виджет покажет только ее отзывы, без фильтра. ' +
      'Отзывы о врачах сюда не входят: MyReviews не связывает врачей с клиниками.',
    hidden:
      'Клиника сейчас скрыта из виджета, поэтому лента на ее странице будет пустой. ' +
      'Включите показ в таблице.',
  },
  doctor: {
    title: 'Код для страницы врача',
    hint: 'Вставьте код на страницу этого врача: виджет покажет только его отзывы, без фильтра.',
    hidden:
      'Врач сейчас скрыт из виджета, поэтому лента на его странице будет пустой. ' +
      'Включите показ в таблице.',
  },
};

interface TargetSnippetDialogProps {
  /** Цель, для страницы которой выводится код; null означает закрытое окно. */
  target: Target | null;
  onClose: () => void;
}

/** Окно с кодом вставки для страницы одной клиники или одного врача. */
export const TargetSnippetDialog: FC<TargetSnippetDialogProps> = ({ target, onClose }) => (
  <Dialog
    open={target !== null}
    title={target === null ? '' : DIALOG_TEXTS[target.kind].title}
    onClose={onClose}
  >
    {/* Содержимое вынесено отдельно: его запрос выполняется только для открытого окна. */}
    {target !== null && <SnippetContent target={target} />}
  </Dialog>
);

interface SnippetContentProps {
  target: Target;
}

const SnippetContent: FC<SnippetContentProps> = ({ target }) => {
  const texts = DIALOG_TEXTS[target.kind];
  const snippet = useQuery(targetSnippetQuery(target.id));

  return (
    <>
      <p className={styles.subject}>{target.name}</p>
      <p className={styles.hint}>{texts.hint}</p>

      {!target.isActive && (
        <div className={styles.notice}>
          <Message tone="warning">{texts.hidden}</Message>
        </div>
      )}

      {snippet.isPending && <Loader text="Готовим код…" />}
      {snippet.isError && <Message>{snippet.error.message}</Message>}
      {snippet.isSuccess && <CopyableCode code={snippet.data.snippet} />}

      <p className={styles.footnote}>
        Код действует на тех же доменах, что и общий код кабинета. Он привязан к записи: если запись
        пропадет из MyReviews и появится снова, код понадобится взять заново.
      </p>
    </>
  );
};
