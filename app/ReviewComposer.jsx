'use client';
import {useState} from 'react';
import {Star,Send} from 'lucide-react';
export default function ReviewComposer({onSave}){
 const [rating,setRating]=useState(0),[hover,setHover]=useState(0),[note,setNote]=useState(''),[open,setOpen]=useState(false);
 function submit(e){e.preventDefault();if(!rating)return;onSave?.(rating,note.trim());setRating(0);setHover(0);setNote('');setOpen(false)}
 if(!open)return <button className="add-review-toggle" type="button" onClick={()=>setOpen(true)}><Star size={16}/> Πρόσθεσε τη δική σου αξιολόγηση</button>;
 return <form className="review-composer" onSubmit={submit}>
  <strong>Πώς ήταν η εμπειρία σου;</strong>
  <div className="review-stars" role="group" aria-label="Βαθμολογία από 1 έως 5 αστέρια">
   {[1,2,3,4,5].map(value=><button type="button" key={value} aria-label={value+' αστέρια'} aria-pressed={rating===value} onMouseEnter={()=>setHover(value)} onMouseLeave={()=>setHover(0)} onClick={()=>setRating(value)}><Star size={28} fill={value<=(hover||rating)?'#e5a54b':'none'} color="#e5a54b"/></button>)}
   <span>{rating?rating+'/5':'Διάλεξε αστέρια'}</span>
  </div>
  <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={400} rows={3} placeholder="Μερικές λέξεις για το μαγαζί (προαιρετικό)"/>
  <div className="review-form-actions"><button type="button" onClick={()=>setOpen(false)}>Άκυρο</button><button type="submit" disabled={!rating}><Send size={15}/> Αποθήκευση</button></div>
  <small>Η αξιολόγησή σου μένει μόνο σε αυτή τη συσκευή.</small>
 </form>;
}
